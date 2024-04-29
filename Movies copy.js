var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect(process.env.DB);

// Movie schema
var MovieSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true },
    releaseDate: Number, 
    genre: {
      type: String,
      enum: [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western', 'Science Fiction'
      ],
    },
    actors: [
    {
      actorName: String, 
      characterName: String,
    }
    ],
}, 
  { collection : 'movies' });
  
const Movie = mongoose.model('Model', MovieSchema);

// return the model
module.exports = mongoose.model('Movie', MovieSchema);
module.exports = Movie;