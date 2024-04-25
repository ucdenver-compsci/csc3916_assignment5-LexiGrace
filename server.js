/*
CSC3916 HW5
File: Server.js
Description: Web API scaffolding for Movie API
Author: Lexi A. 
*/

//imports
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
const crypto = require("crypto");
//const rp = require('request-promise');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
const mongoose = require('mongoose'); 
const cors = require('cors');
require('dotenv').config();

var app = express();
var router = express.Router();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(cors({
    origin: 'https://hw5-1is4.onrender.com'
}));  

//MongoDB connection URI and port
const uri = process.env.DB;
const port = process.env.PORT || 8080;

//connect to MongoDB database
mongoose.connect(uri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

//ROUTES
//signup/ route
router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User({
            name: req.body.name,
            username: req.body.username,
            password: req.body.password
        });

        user.save(function(err) {
            if (err) {
                if (err.code === 11000) {
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                }
                else {
                    return res.json(err);
                }
                    
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

//signin/ route
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
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

//MOVIE ROUTES
router.get('/movies', authJwtController.isAuthenticated, (req, res) => {
    Movie.aggregate([
        {
            $lookup: {
                from: "reviews",
                localField: "_id",
                foreignField: "movieId",
                as: "movie_reviews"
            }
        },
        {
            $addFields: {
                avgRating: { $avg: "$movie_reviews.rating" },
                imageUrl: "$imageUrl" // Include the imageUrl field from the original movie document
            }
        },
        {
            $sort: { avgRating: -1 } 
        }
    ]).exec((err, movies) => {
        if (err) {
            console.error('Error finding movies:', err);
            res.status(500).json({ error: 'An error occurred while fetching movies' });
        } else {
            res.status(200).json(movies);
        }
    });
});

router.get('/movies/:id', authJwtController.isAuthenticated, async (req, res) => {
    const movieId = req.params.id;
  
    const includeReviews = req.query.reviews === 'true';
  
    try {
        if (includeReviews) {
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
                    $addFields: {
                        avgRating: { $avg: '$movie_reviews.rating' }
                    }
                }
            ]);

            if (!result.length || !result[0].title) {
                return res.status(404).json({ error: 'Movie not found' });
            }

            res.status(200).json(result[0]);
        } else {
            const movie = await Movie.findById(movieId);

            if (!movie || !movie.title) {
                return res.status(404).json({ error: 'Movie not found' });
            }

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


router.post('/movies', authJwtController.isAuthenticated, (req, res) => {
    const { title, releaseDate, genre, actors, imageUrl } = req.body;

    // Check if title and releaseDate are provided in the request body
    if (!title || !releaseDate) {
        return res.status(400).json({ error: 'Title and releaseDate are required' });
    }

    // Create a new Movie object and save it to the database
    const newMovie = new Movie({ title, releaseDate, genre, actors, imageUrl });

    newMovie.save()
        .then(savedMovie => {
            // Send the newly saved movie with success response
            res.status(200).json(savedMovie);
        })
        .catch(error => {
            // Handle errors
            console.error("Error saving movie:", error);
            res.status(500).json({ error: "Failed to save movie" });
        });
});

//get route to get movie reviews for specific movie on movie detail page
router.get('/movies/:id/reviews', authJwtController.isAuthenticated, (req, res) => {
    const movieId = req.params.id;

    // Find all reviews with the specified movieId
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
    // const movieId = req.params.movieId;
    const movieId = req.params.id
    const { rating, review } = req.body;
    const username = req.user.username;

    // Create a new review object and save it to the database
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

//put /movies/:title route
router.put('/movies/:title', authJwtController.isAuthenticated, (req, res) => {
    const { title } = req.params;
    const { releaseDate, genre, actors } = req.body;
    //check if title in the request parameters
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
    //find movie from title and update it in the database
    Movie.findOneAndUpdate({ title: title }, { releaseDate, genre, actors }, { new: true })
        .then(updatedMovie => {
            res.status(200).json(updatedMovie);
        })
        .catch(error => res.status(500).json({ error: 'An error occurred while updating the movie' }));
});

//delete /movies/:title route
router.delete('/movies/:title', authJwtController.isAuthenticated, (req, res) => {
    const { title } = req.params;
    //check if title in request parameters
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    Movie.findOneAndDelete({ title: title })
        .then(deletedMovie => {
            if (!deletedMovie) {
                return res.status(404).json({ error: 'Movie not found' });
            }
            res.status(200).json({ message: 'Movie deleted successfully' });
        })
        .catch(error => res.status(500).json({ error: 'An error occurred while deleting the movie' }));
});

//REVIEW ROUTES
//post route to add a review
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
    const { movieId, username, review, rating } = req.body;

    //create new review and save it to database
    const newReview = new Review({ movieId, username, review, rating });
    newReview.save()
        .then(savedReview => {
            res.status(200).json({ message: 'Review created!', review: savedReview });
            trackDimension('Feedback', 'Rating', 'Feedback for Movie', '3', 'Guardian\'s of the Galaxy 2', '1')
            .then(function (response) {
                console.log(response.body);
            })
        })
});

//get route to get a review
router.get('/reviews', authJwtController.isAuthenticated, (req, res) => {
        Review.find()
            .then(reviews => {
                res.status(200).json(reviews);
            })
            .catch(error => {
                console.error('Error fetching reviews:', error);
                res.status(500).json({ error: 'An error occurred while fetching reviews' });
            });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; //for testing only