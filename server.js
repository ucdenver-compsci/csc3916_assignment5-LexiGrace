/*
CSC3916 HW5
File: Server.js
Description: Web API scaffolding for Movie API
 */
var express = require('express');
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
const crypto = require("crypto");
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
const mongoose = require('mongoose');
require('dotenv').config();

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

const uri = process.env.DB;
const port = process.env.PORT || 8080;


mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

//routes
//sign-up/sign-in
router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token, user: userNew.username, password: userNew.password});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

//movies
//main getting movies route
router.get('/movies', authJwtController.isAuthenticated, (req, res) =>{
    //get all movies
    Movie.find({title: { $exists: true}})
            .then(movies => {
                res.status(200).json(movies);
            })
            .catch(error => {
                console.error('Sorry, it looks like there was an error finding movies:', error);
                res.status(500).json({error: 'An error has occurred while looking for this movies'});
            });
});
//save a movie
router.post('/movies',authJwtController.isAuthenticated,(req, res) =>{
    const {title, releaseDate, genre, actors} = req.body;
    if (!title){
        return res.status(400).json({error: 'Please entire a title of a new movie'});
    }
    const newMovie = new Movie ({title, releaseDate, genre, actors});

    newMovie.save()
        .then(savedMovie => {
            res.status(200).json(savedMovie);
        })
        
});


//get route for movie by ID
router.get('/movies/:id', authJwtController.isAuthenticated, async (req, res) => {
    const movieId = req.params.id;
   
    const includeReviews = req.query.reviews === 'true';
    console.log('Movie ID: ', movieId);
    try {
        if (includeReviews) { //review parameter is true
            const result = await Movie.aggregate([
                { $match: { _id: mongoose.Types.ObjectId(movieId) } },
                {
                    $lookup: {
                        from: "reviews",
                        localField: "_id",
                        foreignField: "movieId",
                        as: "movie_reviews"
                    }
                },
                {
                    //average rating for a movie
                    $addFields: {
                        avgRating: { $avg: '$movie_reviews.rating' }
                    }
                }
            ]);
            //no movie found/doesn't have title
            if (!result.length || !result[0].title) {
                return res.status(404).json({ error: 'Movie not found' });
            }
            //movie with review
            res.status(200).json(result[0]);
        } 
        //reviews parameter missing
        else {
            //find movie by ID
            const movie = await Movie.findById(movieId);
            //movie isn't found/doesn't have a title
            if (!movie || !movie.title) {
                return res.status(404).json({ error: 'Movie not found' });
            }
            //needed movie data for response
            const movieWithImageURL = {
                _id: movie._id,
                title: movie.title,
                releaseDate: movie.releaseDate,
                genre: movie.genre,
                actors: movie.actors,
                imageUrl: movie.imageUrl
            };
            res.status(200).json(movieWithImageURL);
        }
    } catch (error) {
        console.error('Error fetching movie:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//update a movie
router.put('/movies/:title', authJwtController.isAuthenticated, (req, res) =>{
    const {title} = req.params;
    const {releaseDate, genre, actors } = req.body;
    
    if (!title){
            return res.status(400).json({error: "You must enter a title to be updated"});
        }
    
    Movie.findOneAndUpdate({title: title}, {releaseDate, genre, actors}, {new: true})
        .then(updatedMovie => {
            res.status(200).json(updatedMovie);
        })
        .catch(error => res.status(500).json({error: 'An error has occurered, movie update was unsuccessful'}));
});
//delete a movie
router.delete('/movies/:title', authJwtController.isAuthenticated, (req, res) =>{
    const {title} = req.params;        
    if (!title){
        return res.status(400).json({error: "You must enter a title to be deleted"});
    }

    Movie.findOneAndDelete({title: title})
    .then (deletedMovie => { 
        if(!deletedMovie){
            return res.status(404).json({error: 'Sorry, that movie was not found'});
            }     
        else{
            res.status(200).json({ message: "Movie successfully deleted"});
        }})
    .catch (error => res.status(500).json({error: 'An error has unexpectedly occurred, movie not deleted'}));
           
});
router.post('/movies/:id/reviews', authJwtController.isAuthenticated,(req,res) =>{
    const movieId = req.params.id;
    const {rating, review} = req.body;
    const username = req.user.username;

    const newReview = new Review ({movieId, username, rating, review});

    newReview.save()
        .then(savedReview => {
            res.status(200).json({message: "Review created", review: savedReview});
        })
        .catch(error => {
            console.error('Error creating the review', error);
            res.status(500).json({error: "Unfortunately, an error occurred creating this review"})
        });
})
router.post('/movies', authJwtController.isAuthenticated, (req, res) => {
    const { title, releaseDate, genre, actors, imageUrl } = req.body;

    //check if title and releaseDate are in the body
    if (!title || !releaseDate) {
        return res.status(400).json({ error: 'Title and release date required' });
    }

    //create new movie object and save it to the database
    const newMovie = new Movie({ title, releaseDate, genre, actors, imageUrl });
    //saving new movie to database
    newMovie.save()
        .then(savedMovie => {
            res.status(200).json(savedMovie);
        })
        .catch(error => {
            console.error("Error saving movie:", error);
            res.status(500).json({ error: "Movie save failure" });
        });
});

//get route to get movie reviews for specific movie on movie detail page
router.get('/movies/:id/reviews', authJwtController.isAuthenticated, (req, res) => {
    const movieId = req.params.id;

    //find all reviews with specific movieId
    Review.find({ movieId })
        .then(reviews => {
            res.status(200).json(reviews);
        })
        .catch(error => {
            console.error('Error fetching reviews:', error);
            res.status(500).json({ error: 'An error occurred while fetching reviews' });
        });
});

//post route to add a review
router.post('/movies/:id/reviews', authJwtController.isAuthenticated, (req, res) => {
    const movieId = req.params.id
    const { rating, review } = req.body;
    const username = req.user.username;

    //create new review object and save it to the database
    const newReview = new Review({ movieId, username, rating, review });

    newReview.save()
        .then(savedReview => {
            res.status(200).json({ message: 'Review created!', review: savedReview });
        })
        .catch(error => {
            console.error('Error creating review:', error);
            res.status(500).json({ error: 'An error occurred while creating the review' });
        });
});


//REVIEW ROUTES
//post route to add a review
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
    const { movieId, username, review, rating } = req.body;

    //create new review and save it to database
    const newReview = new Review({ movieId, username, review, rating });
    newReview.save()
        .then(savedReview => {
            res.status(200).json({ message: 'Review created', review: savedReview });
        })
        
});

//get route to get a review
router.get('/reviews', authJwtController.isAuthenticated, (req, res) => {
    Review.find()
    .then(reviews => {
        res.status(200).json(reviews);
    })
    .catch(error => {
        console.error('Error while searching reviews:', error);
        res.status(500).json({ error: 'An error occurred while searching for reviews' });
    });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; //for testing only