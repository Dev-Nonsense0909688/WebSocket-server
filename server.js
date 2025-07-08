// server.js
const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

let clients = [];

server.on('connection', ws => {
    clients.push(ws);
    ws.on('message', msg => {
        for (let client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg.toString());
            }
        }
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});

console.log("WebSocket server running on port", PORT);
