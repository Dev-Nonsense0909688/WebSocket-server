const http = require("http");
const WebSocket = require("ws");

const ADMIN_LIST = ["Nonsense", "AdminGod", "Root"];
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin, ip }>

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket control server is running.");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, "") || "unknown";
  console.log(`[+] New connection from IP: ${ip}`);

  ws.send("Please send your nickname:");

  let registered = false;

  ws.on("message", (message) => {
    const text = message.toString().trim();

    // First message = nickname
    if (!registered) {
      const nickname = text.slice(0, 32);
      const isAdmin = ADMIN_LIST.includes(nickname);

      clients.set(ws, { nickname, isAdmin, ip });
      registered = true;

      const role = isAdmin ? "ADMIN" : "SLAVE";
      console.log(`[+] ${role} connected: ${nickname} (${ip})`);
      return;
    }

    const clientInfo = clients.get(ws);
    if (!clientInfo) return;

    const { nickname, isAdmin } = clientInfo;

    if (isAdmin && text.startsWith("/command ")) {
      const command = text.slice(9).trim();
      console.log(`[!] Admin ${nickname} issued command: ${command}`);
      sendCommandToSlaves(command);
    } else if (isAdmin) {
      console.log(`[MSG] Admin ${nickname}: ${text}`);
    } else {
      // Slave tried to send a message — ignore it
      console.log(`[BLOCK] Slave ${nickname} tried to send a message. Ignored.`);
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      const role = info.isAdmin ? "ADMIN" : "SLAVE";
      console.log(`[-] ${role} disconnected: ${info.nickname} (${info.ip})`);
      clients.delete(ws);
    }
  });

  ws.on("error", (err) => {
    console.error(`[ERROR] WebSocket error: ${err.message}`);
  });
});

function sendCommandToSlaves(command) {
  for (const [client, { isAdmin }] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && !isAdmin) {
      client.send(`[COMMAND]: ${command}`);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[*] Server listening on port ${PORT}`);
});
