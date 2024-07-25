const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index');
});

let users = {};

io.on('connection', (socket) => {
  socket.on('join-call', (username) => {
    users[socket.id] = { username, muted: false };
    io.emit('update-user-list', users);
  });

  socket.on('mute-unmute', (isMuted) => {
    if (users[socket.id]) {
      users[socket.id].muted = isMuted;
      io.emit('update-user-list', users);
    }
  });

  socket.on('end-call', () => {
    if (users[socket.id]) {
      delete users[socket.id];
      io.emit('update-user-list', users);
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      delete users[socket.id];
      io.emit('update-user-list', users);
    }
  });

  socket.on('offer', (id, description) => {
    socket.to(id).emit('offer', socket.id, description);
  });

  socket.on('answer', (id, description) => {
    socket.to(id).emit('answer', socket.id, description);
  });

  socket.on('ice-candidate', (id, candidate) => {
    socket.to(id).emit('ice-candidate', socket.id, candidate);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
