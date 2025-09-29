const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 6789 });
const clients = new Map(); // Map ws -> username
wss.on('connection', (ws) => {
  let userName = null;
  ws.on('message', (message) => {
    // If username not set, treat first message as username
    if (!userName) {
      userName = message.toString();
      clients.set(ws, userName);
      broadcastAll(`User  <${userName}> has joined the chat`);
      return;
    }
    // Broadcast normal chat messages to others
    for (const [client, name] of clients.entries()) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });
  ws.on('close', () => {
    if (userName) {
      clients.delete(ws);
      broadcastAll(`User  <${userName}> has left the chat`);
    }
  });
});
function broadcastAll(message) {
