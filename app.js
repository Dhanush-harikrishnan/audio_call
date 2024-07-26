const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/room', (req, res) => {
  res.render('room', { roomID: req.query.roomID, username: req.query.username });
});

let rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomID, username }) => {
    socket.join(roomID);
    if (!rooms[roomID]) {
      rooms[roomID] = {};
    }
    rooms[roomID][socket.id] = { username, muted: false };
    io.to(roomID).emit('update-user-list', rooms[roomID]);

    socket.on('mute-unmute', (isMuted) => {
      if (rooms[roomID][socket.id]) {
        rooms[roomID][socket.id].muted = isMuted;
        io.to(roomID).emit('update-user-list', rooms[roomID]);
      }
    });

    socket.on('end-call', () => {
      if (rooms[roomID][socket.id]) {
        delete rooms[roomID][socket.id];
        io.to(roomID).emit('update-user-list', rooms[roomID]);
      }
      socket.leave(roomID);
    });

    socket.on('disconnect', () => {
      if (rooms[roomID] && rooms[roomID][socket.id]) {
        delete rooms[roomID][socket.id];
        io.to(roomID).emit('update-user-list', rooms[roomID]);
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
