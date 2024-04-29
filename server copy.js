/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

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


    //find a movie-including option to find movie based on reviews
router.get('/movies/:id', authJwtController.isAuthenticated, (req, res) =>{
    const movieId = req.params.id;

    const includeReviews = req.query.reviews == true;
    console.log('Movie ID: ', movieId);

    if(includeReviews){
        Movie.aggregate([
            {$match: {_id: mongoose.Types.ObjectId(movieId)}},
                
            {
                $lookup: {
                    from: "reviews",
                    localField: "_id",
                    foreignField: "movieId",
                    as: "reviews"
            }},
            {
                $addFields: {
                  avgRating: { $avg: '$movieReviews.rating' }
                }
              },
              {
                $sort: { avgRating: -1 }
              }
            
        ]).exec(function (err, result){
            if(err){
                return res.status(404).json({error: "Could not find that movie"});
            }
            else{
                res.status(200).json(result[0]);
            }
        });
    }
    else {
        Movie.findById(movieId)
            .then (movie =>{
                if (!movie){
                    return res.status(404).json({error: "Could not find that movie"});
                }
                res.status(200).json(movie);
            })
            .catch(error =>{
                console.error("Error finding movie:",error);
                res.status(404).json({error: "Could not find that movie"});
            });
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

router.get('/movies/:id/reviews',authJwtController.isAuthenticated,(req,res)=>{
    const movieId = req.params.id;

    Review.find({movieId})
        .then(reviews => {
            res.status(200).json(reviews);
        })
        .catch(error =>{
            console.error('Error retrieving reviews: ',error);
            res.stauts(500).json({error: 'Unfortunately, an error occurred while retrieving this review'});
        })
});

    //catch any other request
router.all((req, res) => {
    res.status(405).send({message: "That request method is not currently supported"});
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
module.exports = app; // for testing only


