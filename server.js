const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const ADMIN_LIST = ["Nonsense"];
const clients = new Map(); // Map<WebSocket, { nickname, isAdmin, ip }>
const pendingCommands = new Map(); // Map<slaveName, WebSocket(admin)>

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket control server is running.");
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Start listening
server.listen(PORT, () => {
  console.log(`[*] Server listening on port ${PORT}`);
});

// Handle WebSocket connections
wss.on("connection", handleConnection);

// -------------------- Core logic continues below --------------------
