// server.js
const http = require("http");
const WebSocket = require("ws");

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket server is running!");
});

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", socket => {
  console.log("✅ Client connected");

  socket.on("message", message => {
    console.log("💬 Message from client:", message);
    socket.send("Echo: " + message);
  });

  socket.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

// Use Railway's PORT
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
