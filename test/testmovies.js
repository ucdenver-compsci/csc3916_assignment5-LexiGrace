let envPath = __dirname + "/../.env"
require('dotenv').config({path:envPath});
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../server');
let User = require('../Users');
let Movie = require('../Movies');
chai.should();

chai.use(chaiHttp);

let login_details = {
    name: 'test',
    username: 'email@email.com',
    password: '123@abc'
}

let movie_details = {
    title: 'Twilight',
    releaseDate: 2008,
    genre: 'Drama',
    actors: [ { actorName: 'Kristen Stewart', characterName: 'Bella Swan' }, { actorName: 'Robert Pattinson', characterName: 'Edward Cullen' }, { actorName: 'Billy Burke', characterName: 'Charlie Swan' }],
    imageUrl: "https://www.imdb.com/title/tt1099212/mediaviewer/rm2266076160/"
}

let token = ''

describe('Test Movie Routes', () => {
   before((done) => { //Before  test initialize the database to empty
        User.deleteOne({ name: 'test2'}, function(err, user) {
            if (err) throw err;
        });
       
        Movie.deleteOne({ title: 'Twilight'}, function(err, user) {
            if (err) throw err;
        });
       done();
    })

    after((done) => { //after this test suite empty the database
        User.deleteOne({ name: 'test2'}, function(err, user) {
            if (err) throw err;
        });
       
        Movie.deleteOne({ title: 'Twilight'}, function(err, user) {
            if (err) throw err;
        });
        done();
    })

    describe('/signup', () => {
        it('it should register, login and check our token', (done) => {
          chai.request(server)
              .post('/signup')
              .send(login_details)
              .end((err, res) =>{
                res.should.have.status(200);
                res.body.success.should.be.eql(true);
                //follow-up to get the JWT token
                chai.request(server)
                    .post('/signin')
                    .send(login_details)
                    .end((err, res) => {
                        res.should.have.status(200);
                        res.body.should.have.property('token');
                        token = res.body.token;
                        done();
                    })
              })
        })
    });

    //Test the POST route
    describe('POST Movies', () => {
        it('it return all movies', (done) => {
            chai.request(server)
                .post('/movies')
                .set('Authorization', token)
                .send(movie_details)
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                })
        })
    });

    //Test the GET route
    describe('GET Movies', () => {
        it('it return all movies', (done) => {
            chai.request(server)
                .get('/movies')
                .set('Authorization', token)
                .send()
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('array');
                    res.body.forEach(movie => {
                        movie.should.have.property('title')
                        movie.should.have.property('releaseDate')
                        movie.should.have.property('genre')
                        movie.should.have.property('actors')
                    });
                    done();
                })
        })
    });
});
