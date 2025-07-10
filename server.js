const WebSocket = require("ws");
const http = require("http");
const https = require("https");
const fs = require("fs");
const crypto = require("crypto");
const EventEmitter = require("events");

class EnterpriseWebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      port: process.env.PORT || 3000,
      maxConnections: options.maxConnections || 1000,
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      maxMessagesPerWindow: options.maxMessagesPerWindow || 100,
      heartbeatInterval: options.heartbeatInterval || 30000,
      maxMessageSize: options.maxMessageSize || 1024 * 1024, // 1MB
      adminApiKey: process.env.ADMIN_API_KEY || crypto.randomBytes(32).toString('hex'),
      enableMetrics: options.enableMetrics !== false,
      enableLogging: options.enableLogging !== false,
      enableAuth: options.enableAuth || false,
      enableEncryption: options.enableEncryption || false,
      ...options
    };

    this.clients = new Map();
    this.rooms = new Map();
    this.rateLimitMap = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesProcessed: 0,
      errors: 0,
      startTime: Date.now(),
      roomsCreated: 0,
      messagesSent: 0
    };
    
    this.commandHandlers = new Map();
    this.middlewares = [];
    this.plugins = [];
    
    this.setupDefaultCommands();
    this.setupServer();
    this.startHeartbeat();
    this.startMetricsCollection();
  }

  setupServer() {
    // HTTP/HTTPS Server
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // WebSocket Server with advanced options
    this.wss = new WebSocket.Server({
      server: this.server,
      maxPayload: this.config.maxMessageSize,
      perMessageDeflate: {
        zlibDeflateOptions: {
          threshold: 1024,
          concurrencyLimit: 10,
        },
      },
      verifyClient: (info) => this.verifyClient(info)
    });

    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    this.wss.on("error", (err) => this.handleServerError(err));
  }

  handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    switch(url.pathname) {
      case '/':
        this.sendHealthCheck(res);
        break;
      case '/metrics':
        this.sendMetrics(res);
        break;
      case '/admin':
        this.handleAdminAPI(req, res);
        break;
      case '/rooms':
        this.sendRoomList(res);
        break;
      case '/status':
        this.sendDetailedStatus(res);
        break;
      default:
        res.writeHead(404);
        res.end('Not Found');
    }
  }

  sendHealthCheck(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: Date.now() - this.metrics.startTime,
      connections: this.metrics.activeConnections,
      version: '2.0.0'
    }));
  }

  sendMetrics(res) {
    if (!this.config.enableMetrics) {
      res.writeHead(403);
      res.end('Metrics disabled');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...this.metrics,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      rooms: Array.from(this.rooms.entries()).map(([name, room]) => ({
        name,
        members: room.members.size,
        created: room.created
      }))
    }));
  }

  sendRoomList(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      rooms: Array.from(this.rooms.keys()),
      totalRooms: this.rooms.size
    }));
  }

  sendDetailedStatus(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      server: {
        status: 'running',
        uptime: Date.now() - this.metrics.startTime,
        version: '2.0.0',
        nodeVersion: process.version
      },
      connections: {
        active: this.metrics.activeConnections,
        total: this.metrics.totalConnections,
        limit: this.config.maxConnections
      },
      rooms: Array.from(this.rooms.entries()).map(([name, room]) => ({
        name,
        members: room.members.size,
        created: room.created,
        lastActivity: room.lastActivity
      })),
      performance: {
        messagesProcessed: this.metrics.messagesProcessed,
        errors: this.metrics.errors,
        averageResponseTime: this.calculateAverageResponseTime()
      }
    }));
  }

  verifyClient(info) {
    // Rate limiting by IP
    const ip = info.req.socket.remoteAddress;
    const now = Date.now();
    
    if (!this.rateLimitMap.has(ip)) {
      this.rateLimitMap.set(ip, { count: 0, resetTime: now + this.config.rateLimitWindow });
    }
    
    const rateLimitInfo = this.rateLimitMap.get(ip);
    if (now > rateLimitInfo.resetTime) {
      rateLimitInfo.count = 0;
      rateLimitInfo.resetTime = now + this.config.rateLimitWindow;
    }
    
    if (rateLimitInfo.count >= this.config.maxMessagesPerWindow) {
      return false;
    }
    
    rateLimitInfo.count++;
    
    // Connection limit
    if (this.metrics.activeConnections >= this.config.maxConnections) {
      return false;
    }
    
    return true;
  }

  handleConnection(ws, req) {
    const clientId = crypto.randomUUID();
    const ip = req.socket.remoteAddress;
    
    const client = {
      id: clientId,
      socket: ws,
      username: null,
      room: null,
      ip: ip,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      isAuthenticated: !this.config.enableAuth,
      permissions: new Set(['chat'])
    };
    
    this.clients.set(clientId, client);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    
    this.log(`New connection from ${ip} (${clientId})`);
    
    // Welcome message
    this.sendToClient(client, {
      type: 'welcome',
      message: '🚀 Welcome to Enterprise WebSocket Server v2.0',
      clientId: clientId,
      commands: Array.from(this.commandHandlers.keys())
    });
    
    ws.on('message', (message) => this.handleMessage(client, message));
    ws.on('close', () => this.handleDisconnection(client));
    ws.on('error', (err) => this.handleClientError(client, err));
    ws.on('pong', () => this.handlePong(client));
    
    // Send initial ping
    this.sendPing(client);
    
    this.emit('connection', client);
  }

  async handleMessage(client, message) {
    try {
      client.lastActivity = Date.now();
      client.messageCount++;
      this.metrics.messagesProcessed++;
      
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch {
        data = { type: 'text', content: message.toString().trim() };
      }
      
      // Apply middlewares
      for (const middleware of this.middlewares) {
        const result = await middleware(client, data);
        if (result === false) return; // Middleware blocked the message
      }
      
      // Handle different message types
      if (data.type === 'command' || data.content?.startsWith('/')) {
        await this.handleCommand(client, data);
      } else {
        await this.handleChatMessage(client, data);
      }
      
      this.emit('message', client, data);
    } catch (error) {
      this.handleClientError(client, error);
    }
  }

  async handleCommand(client, data) {
    const content = data.content || data.command;
    const [command, ...args] = content.replace(/^\//, '').split(' ');
    
    if (this.commandHandlers.has(command)) {
      try {
        await this.commandHandlers.get(command)(client, args, data);
      } catch (error) {
        this.sendError(client, `Command error: ${error.message}`);
      }
    } else {
      this.sendError(client, `Unknown command: ${command}`);
    }
  }

  async handleChatMessage(client, data) {
    if (!client.username) {
      this.sendError(client, 'Please set a username first: /user <username>');
      return;
    }
    
    const message = {
      type: 'message',
      from: client.username,
      content: data.content,
      timestamp: Date.now(),
      clientId: client.id
    };
    
    if (client.room) {
      this.broadcastToRoom(client.room, message, client.id);
    } else {
      this.broadcastToAll(message, client.id);
    }
    
    this.metrics.messagesSent++;
  }

  setupDefaultCommands() {
    // User management
    this.addCommand('user', async (client, args) => {
      const username = args[0];
      if (!username || username.length < 2) {
        return this.sendError(client, 'Username must be at least 2 characters');
      }
      
      // Check if username is taken
      for (const [_, c] of this.clients) {
        if (c.username === username && c.id !== client.id) {
          return this.sendError(client, 'Username already taken');
        }
      }
      
      const oldUsername = client.username;
      client.username = username;
      
      this.sendSuccess(client, `Username set to "${username}"`);
      
      if (oldUsername) {
        this.broadcastToAll({
          type: 'user_renamed',
          oldUsername,
          newUsername: username,
          timestamp: Date.now()
        }, client.id);
      }
    });

    // Room management
    this.addCommand('join', async (client, args) => {
      const roomName = args[0];
      if (!roomName) {
        return this.sendError(client, 'Room name required');
      }
      
      if (client.room) {
        this.leaveRoom(client);
      }
      
      this.joinRoom(client, roomName);
    });

    this.addCommand('leave', async (client, args) => {
      if (!client.room) {
        return this.sendError(client, 'Not in a room');
      }
      
      this.leaveRoom(client);
    });

    this.addCommand('rooms', async (client, args) => {
      const roomList = Array.from(this.rooms.entries()).map(([name, room]) => ({
        name,
        members: room.members.size,
        created: new Date(room.created).toISOString()
      }));
      
      this.sendToClient(client, {
        type: 'room_list',
        rooms: roomList
      });
    });

    // Direct messaging
    this.addCommand('dm', async (client, args) => {
      const [targetUsername, ...messageParts] = args;
      con
