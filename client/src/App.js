import React from 'react';
import './App.css';
import openSocket from 'socket.io-client';
const socket = openSocket(require('./config.json').api_ip)

export default class App extends React.Component {
  constructor() {
    super();

    this.state = { records: [] };

    socket.emit('get', { offset: 0, limit: 10 });
    setInterval(()=>{
      socket.emit('get', { offset: 0, limit: 10 });
    }, 300000)

    socket.on('data', (data) => {
      this.setState({ records: data });
    });
  }

  render() {
    return (
        <ul>
          {this.state.records.map((value, index) => {
            return (
              <li key={index} className="d-flex flex-column mb-2">
                <span>Время записи: {value.time}</span>
                <span>Город: {value.city}</span>
                <span>Температура: {value.temperature}</span>
                <span>Влажность: {value.humidity}</span>
                <span>Давление: {value.pressure}</span>
              </li>
            )
          })}
        </ul>
    )
  }

};
