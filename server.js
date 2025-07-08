const http = require("http");
const WebSocket = require("ws");

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

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("🌐 WebSocket chat server is running!");
});

const wss = new WebSocket.Server({ server });
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin }>

const ADMIN_LIST = ["Nonsense", "AdminGod", "Root"];

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, '') || "unknown";
  console.log(`${COLORS.green}✅ New connection from IP: ${ip}${COLORS.reset}`);

  ws.send("👋 Welcome! You can start chatting now:");

  let registered = false;

  ws.on("message", (message) => {
    const text = message.toString().trim();

    // First message = nickname
    if (!registered) {
      const nickname = text.slice(0, 20);
      const isAdmin = ADMIN_LIST.includes(nickname);

      clients.set(ws, { nickname, isAdmin, ip });
      registered = true;

      console.log(`${COLORS.cyan}🙋 ${nickname}${isAdmin ? " 👑 (Admin)" : ""} joined from IP ${ip}${COLORS.reset}`);
      broadcast(`${nickname} joined the chat.`, ws);
      return;
    }

    const { nickname } = clients.get(ws);

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

function broadcast(msg, sender) {
  for (let [client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(msg);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`${COLORS.bold}${COLORS.blue}🚀 Server listening on port ${PORT}${COLORS.reset}`);
});
