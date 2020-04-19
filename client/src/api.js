import openSocket from 'socket.io-client';
const socket = openSocket(require('./config.json').api_ip)

export const subscribeToData = (offset, limit, callback) => {
  socket.on('data', callback)
  socket.emit('subscribeToData', {offset: offset, limit: limit});
};
