const config = require('./config.json');
const fs = require('fs');
const sha512 = require('js-sha512');


//Neo4j database
const neo4j = require('neo4j-driver');
var ndb = new neo4j.driver(config.neo4j.uri);

//Influx database
const Influx = require('influxdb-nodejs');
const influx = new Influx(config.influx.uri);
influx.schema('eco_dat', { city: 's', pressure: 'f', temperature: 'f', humidity: 'f'}, {}, { stripUnknown: true });


//MongoDB database
const mongoose = require('mongoose');
mongoose.connect(config.mongodb.uri, { useNewUrlParser: true, useUnifiedTopology: true });

//Redis database
const redis = require("redis");
const redisClient = redis.createClient(config.redis.uri);


//-----------------------------------
//     Passport.js Authorization
//-----------------------------------
const passport = require('passport');
const LocalStrategy = require('passport-local');
const expressSession = require('express-session');
const User = require('./user');

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use('login', new LocalStrategy({
    passReqToCallback : true
  },
  (req, username, password, done) => {
    User.findOne({ 'username' :  username },
      (err, user) => {
        if (err)
          return done(err);
        if (!user){
          return done(null, false,
                req.flash('message', 'User Not found.'));
        }
        if (!(user.password === sha512(password))){
          return done(null, false,
              req.flash('message', 'Invalid Password'));
        }
        return done(null, user);
      }
    );
}));

passport.use('signup', new LocalStrategy({
    passReqToCallback : true
  },
  (req, username, password, done) => {
    User.findOne({'username':username},function(err, user) {
      if (err){
        return done(err);
      }
      if (user) {
        return done(null, false,
           req.flash('message','User Already Exists'));
      } else {
        var newUser = new User();
        // set the user's local credentials
        newUser.username = username;
        newUser.password = sha512(password);

        newUser.save((err) => {
          if (err){
            console.error(err);
            throw err;
          }
          return done(null, newUser);
        });
      }
    });
  })
);

//--------------------------
//     Base express app
//--------------------------
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const RedisStore = require('connect-redis')(require('express-session'));
const cookieParser = require('cookie-parser');

const sessions = require('express-session')({
  store: new RedisStore({client: redisClient}),
  secret: "super_secret_key",
  resave: true,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    maxAge: 10 * 60 * 1000,
    httpOnly: false,
  },
});

const flash = require('express-flash')
app.use(flash())
app.use(express.static(__dirname + '/public'));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(sessions);
app.use(passport.initialize());
app.use(passport.session());

const noAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated())
    return next();
  res.redirect('/');
};

app.get('/signup', noAuthenticated, (req, res) => {
  res.render('signup', { message: req.flash('message') });
});

app.get('/login', noAuthenticated, (req, res) => {
  res.render('login', { message: req.flash('message') });
});

app.post('/login', passport.authenticate('login', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash : true
}));

app.post('/signup', passport.authenticate('signup', {
  successRedirect: '/',
  failureRedirect: '/signup',
  failureFlash : true
}));

app.post('/cities', (req, res) => {
  res.send(JSON.stringify(config.cities));
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated())
    return next();
  res.redirect('/login');
};

app.get('/*', isAuthenticated, (req, res) => {
  console.log(req.user);
  if(!req.user) { res.redirect('/login'); }
  res.sendFile(__dirname + '/public/client.html');
});



//----------------------------
//     Base socket server
//----------------------------
const http = require('http').createServer(app);
const socketio = require('socket.io')(http);

const getCities = (country) => {
  return new Promise(async (resolve, reject) => {
    const sess = ndb.session();
    try {
      const result = await sess.run('MATCH (c:City)-[n:REL]->(ct:Country { country: $country }) RETURN c;', { country: country });
      let res = [];
      console.log(result.records);
      for(var i = 0; i < result.records.length; i++) {
        res.push(result.records[i].get(0).properties.city);
      }
      console.log(res);
      resolve(res);
    }
    catch(err) { reject(err) }
    finally {
      sess.close();
    }
  });
}
const getCountries = () => {
  return new Promise(async (resolve, reject) => {
    const sess = ndb.session();
    try {
      const result = await sess.run('MATCH (n:Country) RETURN n');
      let res = [];
      console.log(result.records);
      for(var i = 0; i < result.records.length; i++) {
        res.push(result.records[i].get(0).properties.country);
      }
      console.log(res);
      resolve(res);
    }
    catch(err) { reject(err) }
    finally {
      sess.close();
    }
  });
}

const addCountry = async (country) => {
  if(!country) return;
  const sess = ndb.session();
  try {
    sess.run('MERGE (n:Country {country: $country}) RETURN n', { country: country });
  }
  catch(err) { console.error(err) }
  finally {
    sess.close();
  }
}

const addCity = (country, city) => {
  if(!country || !city) return;
  const sess = ndb.session();
  try {
    sess.run('MERGE (c:City {city: $city}), (ct:Country {country: $country})\n CREATE (c)-[n:REL]->(ct)\n RETURN n, c;', { country: country, city: city });
  }
  catch(err) { console.error(err) }
  finally {
    sess.close();
  }
}

socketio.on('connection', (socket) => {
  socket.on('get', (filter) => {
    let reader = influx.query('eco_dat');
    reader.set({
      format: 'json',
      limit: filter.limit || 10,
      offset: filter.offset || 0
    })
    if(filter.city) {
      reader.where('city', filter.city || "");
    }
    reader.then((data)=>{
      socket.emit('data', data.eco_dat || []);
    })
    .catch(console.error);
  });

  socket.on('add_country', (data)=>{addCountry(data.country)})
  socket.on('add_city', (data)=>{addCity(data.country, data.city)})

  socket.on('cities', (data) => {
    getCities(data.country)
    .then((d)=>{
      console.log(d);
      socket.emit('cities', getCities(d));
    })
    .catch(console.error)
  })
  socket.on('countries', () => {
    getCountries()
    .then((data)=>{
      socket.emit('countries', data);
    })
    .catch(console.error);
  })

});

const Weather = require('weather');
const weather = new Weather(config.weather);
const getWeather = (coords) => {
  return new Promise((resolve, reject) => {
    weather.now(coords)
    .then((results) => {
      resolve({ city: results.city, temperature: results.temperature, humidity: results.humidity, pressure: results.barometerPressure });
    })
    .catch(reject);
  });
};

const collectData = () => {
  config.cities.forEach((item, i) => {
    getWeather(item)
    .then((data) => {
      influx.write('eco_dat')
      .field({
        city: item,
        temperature: data.temperature,
        pressure: data.pressure,
        humidity: data.humidity
      })
      .then(() => console.log('Write point ' + data.city + ' success'))
      .catch(console.error);
    })
    .catch(console.error);
  });
};

setInterval(()=> {
  collectData();
}, 1800000)

http.listen(80, ()=>{
  console.log("Server successfully started on port 80");
});
