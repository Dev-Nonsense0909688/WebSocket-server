const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("🌐 WebSocket chat server is running!");
});

const wss = new WebSocket.Server({ server });
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin }>

// Optional: hardcoded admin names
const ADMIN_LIST = ["Nonsense", "AdminGod", "Root"];

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, '') || "unknown";
  console.log(`✅ New connection from IP: ${ip}`);

  ws.send("👋 Welcome! Please enter your nickname to join:");

  let registered = false;

  ws.on("message", (message) => {
    const text = message.toString().trim();

    // First message = nickname
    if (!registered) {
      const nickname = text.slice(0, 20); // limit to 20 chars
      const isAdmin = ADMIN_LIST.includes(nickname);

      clients.set(ws, { nickname, isAdmin, ip });
      registered = true;

      console.log(`🙋 ${nickname} joined from IP ${ip}${isAdmin ? " (Admin)" : ""}`);
      broadcast(`${nickname} joined the chat.`, ws);
      return;
    }

    const { nickname } = clients.get(ws);

    // Broadcast chat message
    const formatted = `${nickname}: ${text}`;
    console.log("💬", formatted);
    broadcast(formatted, ws);
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      console.log(`❌ ${info.nickname} disconnected (IP: ${info.ip})`);
      broadcast(`${info.nickname} left the chat.`, ws);
      clients.delete(ws);
    }
  });

  ws.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
});

// Broadcast to all *other* clients
function broadcast(msg, sender) {
  for (let [client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(msg);
    }
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
