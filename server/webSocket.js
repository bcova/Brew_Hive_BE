const express = require('express');
const jwt = require('jsonwebtoken');
const socketIo = require('socket.io');
const http = require('http');
const pool = require("../server/dbPool");

const app = express();
app.use(express.json());

// ... Other middleware and routes ...

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST']
  }
});



// Start the server
const PORT = 6000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
