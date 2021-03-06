//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var Facebook = require('fbgraph');
var mongoose = require('mongoose');
var app = express();

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

var FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
var FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
var FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL;


//connect to database
mongoose.connect(process.env.MONGODB_CONNECTION_URL);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    models.igUser.findOrCreate({
      "ig_name": profile.username,
      "ig_id": profile.id,
      "ig_access_token": accessToken 
    }, function(err, user, created) {
      
      // created will be true here
      models.igUser.findOrCreate({}, function(err, user, created) {
        // created will be false here
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      })
    });
  }
));


//Use FacebookStrategy
passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    models.fbUser.findOrCreate({
      "fb_name": profile.username,
      "fb_id": profile.id,
      "fb_access_token": accessToken 
    }, function(err, user, created) {
      
      // created will be true here
      models.fbUser.findOrCreate({}, function(err, user, created) {
        // created will be false here
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      })
    });
  }
));

//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
// function ensureAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) { 
//     return next(); 
//   }
//   res.redirect('/login');
// }

function ensureAuthenticatedIG(req, res, next) {
  if (req.isAuthenticated() && res.req.user.provider == 'instagram') { 
    return next(); 
  }
  res.redirect('/login');
}

function ensureAuthenticatedFB(req, res, next) {
  if (req.isAuthenticated() && res.req.user.provider == 'facebook') { 
    return next(); 
  }
  res.redirect('/login');
}

//routes
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.get('/accountIG', ensureAuthenticatedIG, function(req, res){
  // console.log(req.user);
  var userJSON = {};
  userJSON.name = req.user.username;
  userJSON.msg = "Keep smiling.";
  userJSON.links = [{url:"/photos", img:"img/camera.png", text:"View your photos in a cute layout"}];
  res.render('account', {user: userJSON});
});

app.get('/accountFB', ensureAuthenticatedFB, function(req, res){
  // console.log(req.user);
  var userJSON = {};
  userJSON.name = req.user.displayName;
  userJSON.msg = "Looking good today.";
  userJSON.links = [{url:"/fb-photos", img:"img/camera.png", text:"View your photos in a cute layout"}, {url:"/fb-likes", img:"img/fblike.png", text:"See something cool about your recent likes"}];
  res.render('account', {user: userJSON});
});

app.get('/photos', ensureAuthenticatedIG, function(req, res){
  var query  = models.igUser.where({ ig_name: req.user.username });
  // console.log("user: " + JSON.stringify(req.user, null, 2));
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched
      Instagram.users.self({
        access_token: user.ig_access_token,
        count: 200,  //results in subset of count images that are not private
        complete: function(data) {
          //Map will iterate through the returned data obj
          var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = {};
            tempJSON.url = item.images.low_resolution.url;
            tempJSON.caption = item.caption.text;
            tempJSON.width = 306;
            tempJSON.height = 306;
            //insert json object into image array
            return tempJSON;
          });
          res.render('photos', {photos: imageArr, backlink: {url:"/accountIG"}, containerClass: {name:"container-fluid"}});
        }
      }); 
    }
  });
});

app.get('/fb-photos', ensureAuthenticatedFB, function(req, res){
  // console.log("user: " + JSON.stringify(req.user, null, 2));
  var query = models.fbUser.where({ fb_id: req.user.id });
  query.findOne(function (err, user) {

    if (err) return handleError(err);
    if (user) {
    // console.log("found user in db");
    // console.log(user);

      Facebook.setAccessToken(user.fb_access_token);
      // Facebook.get("/me?fields=feed",  function(err, results) {
      Facebook.get("/"+user.fb_id + "/photos",  function(err, results) {
        // console.log(results.data[0].images); 
        // console.log(results.data[1].images);
        // console.log(results.data[2].images);
        var imageArr = results.data.map(function(item){
          tempJSON = {};
          tempJSON.url = item.images[item.images.length - 1].source;
          tempJSON.caption = item.name;
          tempJSON.width = item.images[item.images.length - 1].width;
          tempJSON.height = item.images[item.images.length - 1].height;

          return tempJSON;
        });
        res.render('photos', {photos: imageArr, backlink: {url:"/accountFB"}, containerClass: {name:"container"}});
      });
    }
  });
})

app.get('/fb-likes', ensureAuthenticatedFB, function(req, res){
  // console.log("user: " + JSON.stringify(req.user, null, 2));
  var query = models.fbUser.where({ fb_id: req.user.id });
  query.findOne(function (err, user) {

    if (err) return handleError(err);
    if (user) {

      Facebook.setAccessToken(user.fb_access_token);
      Facebook.get("/"+user.fb_id + "/likes",  function(err, results) {
        //count word frequencies {word1:count1, word2:count2, ...}
        var likesJSON = {};
        for (i = 0; i < results.data.length; i++) {
          likesJSON[results.data[i].category] = likesJSON[results.data[i].category] ? (likesJSON[results.data[i].category] + 1) : 1;
          likesJSON[results.data[i].name] = likesJSON[results.data[i].name] ? (likesJSON[results.data[i].name] + 1) : 1;
        }

        //sort categories by most popular [[word, count], [word, count], ...]
        var sortedArray = [];
        for(likeWord in likesJSON){
          sortedArray.push([likeWord, likesJSON[likeWord]])
        }
        sortedArray.sort(function(a,b){return b[1] - a[1]});

        // convert sortedArray to render [{word:w1, count:c1}, {word:w2, count:c2}, ...]
        var sortedArrayJSON = sortedArray.map(function(item){
          tempJSON = {};
          tempJSON.word = item[0];
          tempJSON.count = item[1];
          tempJSON.fontSize = item[1]*20;
          return tempJSON;
        });

        res.render('likes', {likes: sortedArrayJSON, backlink: {url:"/accountFB"}});
      });
    }
  });
})


// GET /auth/instagram
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Instagram authentication will involve
//   redirecting the user to instagram.com.  After authorization, Instagram
//   will redirect the user back to this application at /auth/instagram/callback
app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

// GET /auth/instagram/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/accountIG');
  });

///// SAME IDEA FOR FACEBOOK BELOW /////

// GET /auth/facebook
app.get('/auth/facebook',
  passport.authenticate('facebook', {scope: ['user_photos', 'user_likes']}));

// GET /auth/facebook/callback
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/accountFB');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
