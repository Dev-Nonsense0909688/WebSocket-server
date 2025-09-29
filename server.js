const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 6789 });
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (message) => {
    // Broadcast to all other clients except sender
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
  });
});
console.log('Server running at ws://localhost:6789');
