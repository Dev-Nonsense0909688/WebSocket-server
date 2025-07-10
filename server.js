const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map(); // username -> socket

wss.on("connection", (ws) => {
  let username = null;

  ws.send("Welcome! Set username: /user yourname");
  
  if (msg === '/receivers') {
  const receiverList = [...clients.keys()].filter(name => name.startsWith('receiver_'));
  ws.send(`[Receivers Online]: ${receiverList.join(', ') || 'None'}`);
  return;
}
  ws.on("message", (message) => {
    const msg = message.toString().trim();

    // Set username
    if (msg.startsWith("/user ")) {
      const name = msg.slice(6).trim();
      if (!name || clients.has(name)) {
        ws.send("❌ Username invalid or taken.");
        return;
      }
      username = name;
      clients.set(username, ws);
      ws.send(`✅ You are now "${username}"`);
      return;
    }

    if (!username) {
      ws.send("❗ Set username first using /user yourname");
      return;
    }

    // Private message
    if (msg.startsWith("/to ")) {
      const parts = msg.slice(4).split(" ");
      const targetUser = parts.shift();
      const msgBody = parts.join(" ");
      const targetSocket = clients.get(targetUser);
      if (!targetSocket) {
        ws.send(`❌ User "${targetUser}" not found.`);
        return;
      }
      targetSocket.send(`[DM from ${username}] ${msgBody}`);
      return;
    }

    // Broadcast to everyone except sender
    for (let [name, clientWs] of clients) {
      if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(`${username}: ${msg}`);
      }
    }
  });

  ws.on("close", () => {
    if (username) {
      clients.delete(username);
      console.log(`👋 ${username} disconnected`);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
});
