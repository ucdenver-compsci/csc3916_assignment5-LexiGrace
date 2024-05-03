/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authController = require('./auth');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies');
const Review = require('./Reviews');

const router = express.Router();

const app = express();
app.use(cors({origin: 'https://assignment-4-react.onrender.com'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', router);

app.use(passport.initialize());


function getJSONObjectForMovieRequirement(req) {
    const json = {
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

router.post('/signup',
    function(req, res) {

    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        const user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code === 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin',
    function (req, res) {

    const userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').
    exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                const userToken = {id: user.id, username: user.username};
                const token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')

    .all(passport.authenticate('jwt', {session : false}))

    .get(function(req, res) {
        if (req.query.review === 'true') {
            Movie.aggregate([
               

                {
                    $lookup: {
                        from: "Review", // name of the foreign collection
                        localField: "_id", // field in the orders collection
                        foreignField: "movieId", // field in the items collection
                        as: "Review" // output array where the joined items will be placed
                    }
                },
                {
                    $addFields: {
                        avgRating: { $avg: '$reviews.rating' },
                        imageURL: '$imageURL'
                    }
                },
                {
                    $sort: { avgRating: -1 }
                }
            ]).exec(function(err, result) {
                if (err) {
                    // handle error
                    if (err)
                        res.status(500).send({success: false, msg: 'Failed to get reviews.'});
                } else {
                    res.json(result);
                    console.log(result);
                }
            });
        } else {
            Movie.find(title ? {title} : {}, function(err, result) {
                if (err) {
                    // handle error
                    if (err)
                        res.status(500).send({success: false, msg: 'Failed to get reviews.'});
                } else {
                    res.json(result);
                    console.log(result);
                }
            })
        }})

    .post(function(req, res) {
        const movie = new Movie(req.body);
        movie.save((err, result) => {
            if (err) {
                // handle error
                if (err)
                    res.status(500).send({success: false, msg: 'Failed to save.'});
            } else {
                res.json(result);
                console.log(result);
            }
        })
    })

    .put(function(req, res) {
        Movie.findOneAndUpdate(req.body._id, req.body, {new: true}, (err,
                                                                      result) => {
            if (err) {
                // handle error
                res.status(500).send({success: false, msg: 'Failed to update.'});
            } else {
                res.json(result);
                console.log(result);
            }
        });
    })

    .delete(function(req, res) {
        Movie.findByIdAndDelete(req.body._id, (err, result) => {
            if (err) {
                // handle error
                res.status(500).send({success: false, msg: 'Failed to delete.'});
            } else {
                res.json(result);
                console.log(result);
            }
        });
    });

router.route('/reviews')

    .all(passport.authenticate('jwt', {session : false}))

    .get(function(req, res) {
        Review.find({}).exec(function(err, result) {
            if (err) {
                res.status(500).send({success: false, msg: 'Failed to get reviews.'});
            }
            res.json(result);
            console.log(result);
        })
    })

    .post(function(req, res) {
        const review = new Review(req.body);
        Movie.find({title: req.body.title}, function(err, result) {
            if (result.length !== 0) {
                review.movieId = res[0]._id.toString();
                review.username = req.body.username;
                review.review = req.body.review;
                review.rating = req.body.rating;

                review.save(function(err) {
                    if (err) {
                        res.status(500).send({success: false, msg: 'Failed to get reviews.'});
                    } else {
                        res.json(result);
                        console.log(result);
                    }
                })
            }
        })
        review.save((err, result) => {
            if (err) {
                res.status(500).send({success: false, msg: 'Failed to get reviews.'});
            } else {
                res.json(result);
                console.log(result);
            }
        });
    })

    .delete(function(req, res) {
        Review.findByIdAndDelete(req.body._id, (err, result) => {
            if (err) {
                res.status(500).send({success: false, msg: 'Failed to delete review.'});
            } else {
                res.json(result);
                console.log(result);
            }
        });
    });

router.route('/movies/:movieparameter')
    .get(function(req, res) {
        id = req.params.id;

        if (req.query.review) {
            const aggregate = [
                {
                    $match: {
                        _id : mongoose.Types.ObjectId(id),
                    }
                },
                {
                    $lookup: {
                        from: 'review',
                        localField: '_id',
                        foreignField: 'movieId',
                        as: 'review'
                    }
                },
                {
                    $addFields: {
                        avgRating: {$avg: '$review.rating'}
                    }
                }
            ];
            Movie.aggregate(aggregate).exec(function(err, result) {
                if (err) {
                    res.status(500).send({success: false, msg: 'Failed to get reviews.'});
                } else {
                    res.json(result);
                    console.log(result);
                }
            });
        } else {
            Movie.find({_id: id}).exec(function(err, result) {
                if (err) {
                    res.status(500).send({success: false, msg: 'Failed to get reviews.'});
                } else {
                    res.json(result);
                    console.log(result);
                }
            })
        }
    })

    .put(function(req, res) {
        title = req.params.title;

        Movie.updateOne({title: title}, {$set: {title: title}}).exec(function(err, result) {
            if (err) {
                res.status(500).send({success: false, msg: 'Failed to update review.'});
            } else {
                res.json(result);
                console.log(result);
            }
        })
    })

    .delete(function(req, res) {
        title = req.params.title;

        Movie.deleteOne({title: title}).exec(function(err, result) {
            if (err) {
                res.status(500).send({success: false, msg: 'Failed to delete review.'});
            } else {
                res.json(result);
                console.log(result);
            }
        })
    })

    .all(function(req, res) {
        res.status(405).send({success: false, msg: 'HTTP method unsupported.'});
    })

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only