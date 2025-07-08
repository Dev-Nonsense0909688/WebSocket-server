const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: PORT ,host: '0.0.0.0'});

server.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('message', (message) => {
        console.log('Message:', message);
        // Echo the message back
        socket.send(`Echo: ${message}`);
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log(`WebSocket server running on port ${PORT}`);
