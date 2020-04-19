const config = require('./config.json');
const fs = require('fs');

const Influx = require('influxdb-nodejs');
const influx = new Influx(config.influx.uri);

influx.schema('eco_dat', { city: 's', pressure: 'f', temperature: 'f', humidity: 'f'}, {}, { stripUnknown: true });

//--------------------------
//     Base express app
//--------------------------
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
})

//----------------------------
//     Base socket server
//----------------------------
const http = require('http').createServer(app);
const socketio = require('socket.io')(http);

socketio.on('connection', (socket) => {
  socket.on('get', (filter) => {
    influx.query('eco_dat')
    .set({
      format: 'json',
      limit: filter.limit || 10,
      offset: filter.offset || 10
    })
    .then((data)=>{
        socket.emit('data', data.eco_dat || []);
    })
    .catch(console.error);
  });
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
        city: data.city,
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

collectData();
const collectWeatherCycle = () => {
  setTimeout(()=> {
    collectData();
    collectWeatherCycle();
  }, 1800000);
};
collectWeatherCycle();

http.listen(80, ()=>{
  console.log("Server successfully started on port 80");
});
