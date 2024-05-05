/*
CSC3916 HW2
File: Server.js
Description: Web API scaffolding for Movie API
 */
var env = require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var ExtractJwt = require('passport-jwt').ExtractJwt;
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Reviews = require('./Reviews');
var mongoose = require('mongoose');

var app = express();
app.use(cors({
    origin: 'https://assignment-4-react.onrender.com'
}));  
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: '/Please include both username and password.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                console.log(err.message);
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
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});
router.route('/movies')
    .get((req, res) => {
        if (req.query.reviews == "true")
        {
            const aggregate = [
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_id',
                        foreignField: 'movieId',
                        as: 'reviews'
                    }
                },
                {
                  $addFields: {
                    avgRating: { $avg: '$reviews.rating' }
                  }
                },
                {
                  $sort: { avgRating: -1 }
                }
            ];
            Movie.aggregate(aggregate).exec(function(err, doc) 
            {
                if (err)
                {
                    console.log(err)
                }
                res.json({success: true, movies: doc});
            });
        }
        else
        {
            // Return all movies
            Movie.find({}).exec(function(err, movies) {
            if (err) {
                console.log(err);
            }

            res.json ({success: true, movies: movies})
            })   
        }
        
    })
    .post(authJwtController.isAuthenticated, (req, res) => {
        Movie.find({title: req.body.title}).exec(function (err, found) {
            if (err)
                console.log(err);
            // movie is found
            if (found.length != 0)
                return res.json({success: false, msg: 'That movie already exists.'});
            else // movie is not found
            {
                // Save a single movie
                var newMovie = new Movie();
                newMovie.title = req.body.title;
                newMovie.releaseDate = req.body.releaseDate;
                newMovie.genre = req.body.genre;
                newMovie.actors = req.body.actors;

                if (newMovie.releaseDate < 1888 || newMovie.actors.length < 3 || !Movie.schema.path('genre').enumValues.includes(newMovie.genre))
                    res.status(400).send({success: false, message: 'Unable to add this film.'});
                else
                {
                    newMovie.save(function(err){
                        if (err) {
                            console.log(err.message);
                            return res.json(err);
                        }
    
                        res.json({success: true, message: 'Successfully created movie.'});
                    });
                }
            }
        })
    })
    .all((req, res) => {
        res.status(405).send({message: 'HTTP method not supported.' });
    })
router.route('/movies/:movieparameter')
    .get((req, res) => {
        id = req.params.movieparameter;
        if (req.query.reviews == "true")
        {
            const aggregate = [
                {
                    $match: {
                        _id : mongoose.Types.ObjectId(id)
                    }
                },
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_id',
                        foreignField: 'movieId',
                        as: 'reviews'
                    }
                },
                {
                  $addFields: {
                    avgRating: { $avg: '$reviews.rating' }
                  }
                }
            ];
            Movie.aggregate(aggregate).exec(function(err, doc) 
            {
                if (err)
                {
                    console.log(err)
                }
                res.json({success: true, movie: doc[0]});
            });
        }
        else
        {
            Movie.find({_id: id}).exec(function(err, movie) {  
                if (err)
                    console.log(err);
                if (movie.length == 1)
                {
                    res.json ({success: true, movie: movie});
                }
                else 
                {
                    res.json({success: false});
                }
            })
        }
        
    })
    .put(authJwtController.isAuthenticated, (req,res) => {
        title = req.params.movieparameter;
        // For now I am assuming that a partial match should overwrite the title of the film, only one argument is given to PUT /movies/nameTitle
        Movie.updateOne({title: {$regex: title}}, {$set: {'title': title}}).exec(function(err, set) {
            if (err)
                console.log(err);
            if (set.n == 1)
                res.json ({success: true});
            else
                res.json ({success: false});
        })
    })
    .delete(authJwtController.isAuthenticated, (req,res) => {
        title = req.params.movieparameter;
        Movie.deleteOne({title: title}).exec(function(err, rem) {
            if (err)
                console.log(err);
            if (rem.n == 1)
                res.json ({success: true});
            else
                res.json ({success: false});
        })
    })
    .all((req, res) => {
        res.status(405).send({message: 'HTTP method not supported.' });
    })
router.route('/reviews')
    .get((req, res) => {
        // Return all reviews
        Reviews.find({}).exec(function(err, reviews) {
            if (err) {
                console.log(err);
            }

            res.json ({success: true, reviews: reviews})
        })
    })
    .post(authJwtController.isAuthenticated, (req, res) => {
         // Save a single review
         var newReview = new Reviews();
         //Find the movieId from title
         Movie.find({title: req.body.title}).exec(function(err, movie) {
            if (movie.length != 0)
            {
                newReview.movieId = movie[0]._id.toString()
                newReview.username = req.body.username;
                newReview.review = req.body.review;
                newReview.rating = req.body.rating;
                
                newReview.save(function(err){
                    if (err) {
                        console.log(err.message);
                        return res.json(err);
                    }

                    res.json({success: true, message: 'Review created!'});
                })
            }
            else
                res.json({success: false});
         });
    })

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only