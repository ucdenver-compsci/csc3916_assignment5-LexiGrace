var mongoose = require('mongoose');
mongoose.connect(process.env.DB);

const MovieSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
    releaseDate: { type: String, required: true }, 
    genre: {
      type: String,
      enum: [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western', 'Science Fiction'
      ],
    },
    actors: [{
      actorName: String, 
      characterName: String,
    }],
    imageUrl: { type: String }, 
  }, { collection : 'movies' });
  

//return the model
const MovieModel = mongoose.model('Movie', MovieSchema);
module.exports = MovieModel;