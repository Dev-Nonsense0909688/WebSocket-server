const WebSocket = require('ws');
const http = require('http');

const PORT = 3000;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map(); // username -> websocket

wss.on('connection', (ws) => {
  let username = null;

  ws.send('Welcome! Please send your username first using: /user yourname');

  ws.on('message', (message) => {
    const msg = message.toString().trim();

    // Handle setting username
    if (msg.startsWith('/user ')) {
      const name = msg.slice(6).trim();
      if (!name || clients.has(name)) {
        ws.send('Username invalid or taken. Try another.');
        return;
      }
      username = name;
      clients.set(username, ws);
      ws.send(`Username set to "${username}". You can now send messages!`);
      return;
    }

    if (!username) {
      ws.send('Set a username first using /user yourname');
      return;
    }

    // Private message: /to targetUser message here
    if (msg.startsWith('/to ')) {
      const split = msg.slice(4).split(' ');
      const targetUser = split.shift();
      const msgBody = split.join(' ');
      const targetSocket = clients.get(targetUser);
      if (!targetSocket) {
        ws.send(`User "${targetUser}" not found.`);
        return;
      }
      targetSocket.send(`[Private] ${username}: ${msgBody}`);
      return;
    }

    // Broadcast message to everyone else
    for (let [name, clientWs] of clients) {
      if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(`${username}: ${msg}`);
      }
    }
  });

  ws.on('close', () => {
    if (username) clients.delete(username);
    console.log(`${username || 'Unknown'} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket chat server running on ws://localhost:${PORT}`);
});
