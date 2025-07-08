const WebSocket = require('ws');

// Railway gives us a random port for deployment — never hardcode 8080 in production
const PORT = process.env.PORT || 8080;

// Create a WebSocket server and bind it to 0.0.0.0 for public access
const wss = new WebSocket.Server({
  port: PORT,
  host: '0.0.0.0'
});

console.log(`✅ WebSocket server running on port ${PORT}`);

// Handle connection events
wss.on('connection', (socket) => {
  console.log('👤 Client connected');

  socket.on('message', (message) => {
    console.log('💬 Message from client:', message.toString());

    // Echo the message back to the client
    socket.send(`Server says: ${message}`);
  });

  socket.on('close', () => {
    console.log('❌ Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('💥 Socket error:', err.message);
  });
});
