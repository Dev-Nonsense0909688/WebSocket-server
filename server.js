const http = require("http");
const WebSocket = require("ws");

// 🎨 Terminal colors for logs
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

// 🧠 Admin nicknames
const ADMIN_LIST = ["Nonsense", "AdminGod", "Root"];

// 🗺️ Store all clients
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin, ip }>

// 🌐 Basic HTTP server for keep-alive or status check
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("🟢 WebSocket chat server with admin control is running.");
});

// 🌐 WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, '') || "unknown";
  console.log(`${COLORS.green}✅ New connection from IP: ${ip}${COLORS.reset}`);

  ws.send("👋 Welcome! Please enter your nickname:");

  let registered = false;

  ws.on("message", (message) => {
    const text = message.toString().trim();

    // 👤 First message = nickname
    if (!registered) {
      const nickname = text.slice(0, 20);
      const isAdmin = ADMIN_LIST.includes(nickname);

      clients.set(ws, { nickname, isAdmin, ip });
      registered = true;

      console.log(`${COLORS.cyan}🙋 ${nickname}${isAdmin ? " 👑 (Admin)" : ""} joined from ${ip}${COLORS.reset}`);
      broadcast(`${nickname} joined the chat.`, ws);
      return;
    }

    const clientInfo = clients.get(ws);
    if (!clientInfo) return;

    const { nickname, isAdmin } = clientInfo;

    // 🧠 Handle admin command
    if (isAdmin && text.startsWith("/command ")) {
      const command = text.slice(9).trim();
      console.log(`${COLORS.yellow}⚙️ Admin ${nickname} issued command: ${command}${COLORS.reset}`);
      sendCommandToClients(command);
      return;
    }

    // 💬 Regular message
    const formatted = `${nickname}: ${text}`;
    console.log(`${COLORS.magenta}💬 ${formatted}${COLORS.reset}`);
    broadcast(formatted, ws);
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      console.log(`${COLORS.red}❌ ${info.nickname} disconnected (IP: ${info.ip})${COLORS.reset}`);
      broadcast(`${info.nickname} left the chat.`, ws);
      clients.delete(ws);
    }
  });

  ws.on("error", (err) => {
    console.error(`${COLORS.red}⚠️ WebSocket error: ${err.message}${COLORS.reset}`);
  });
});

// 📢 Send message to all except sender
function broadcast(msg, sender) {
  for (let [client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(msg);
    }
  }
}

// 🚨 Send command to ALL non-admin clients
function sendCommandToClients(command) {
  for (let [client, { isAdmin }] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && !isAdmin) {
      client.send(`[COMMAND]: ${command}`);
    }
  }
}

// 🚀 Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`${COLORS.bold}${COLORS.blue}🚀 Server running on port ${PORT}${COLORS.reset}`);
});
