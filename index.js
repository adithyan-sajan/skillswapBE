// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http'); // 🚨 1. IMPORT NATIVE HTTP
const { Server } = require('socket.io'); // 🚨 2. IMPORT SOCKET.IO

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 🚨 3. CREATE THE HYBRID SERVER
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Database Connection
// Only auto-connect when this file is the entrypoint (skipped when required by tests)
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('⚡ Connected to MongoDB Matrix'))
    .catch((err) => console.error('Database error:', err));
}

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/listings', require('./routes/listingRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/escrow', require('./routes/escrowRoutes'));
app.use('/api/admin', require('./routes/adminRoutes')); // S9: Admin routes

// 🚨 4. THE SOCKET.IO ENGINE
// S4: Socket auth middleware — verify JWT from cookie before allowing connection
io.use(async (socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split(';')
    .find(c => c.trim().startsWith('jwt='))
    ?.trim()
    .split('=')[1];
  if (!token) {
    return next(new Error('Authentication error: no session cookie'));
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (decoded.type !== 'access') {
      return next(new Error('Authentication error: refresh token not accepted at socket level'));
    }
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) return next(new Error('Authentication error: user not found'));
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id} (user: ${socket.user?.username})`);

  // ==========================================
  // 💬 CHAT SYSTEM LOGIC
  // ==========================================
  socket.on('join_chat', (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined chat room: ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    // S4: Use the authenticated user's id as the sender — never trust client-supplied senderId
    const messageData = {
      conversationId: data.conversationId,
      senderId: socket.user._id,
      text: data.text,
      createdAt: new Date().toISOString()
    };
    io.to(data.conversationId).emit('receive_message', messageData);

    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');

      const newMessage = await Message.create(messageData);

      await Conversation.findByIdAndUpdate(data.conversationId, {
        lastMessage: newMessage._id
      });
    } catch (err) {
      console.error("Failed to save message to DB", err);
    }
  });

  // ==========================================
  // 🎨 WHITEBOARD & VIDEO SESSION LOGIC
  // ==========================================
  // 1. Join the specific Session Room (from the Dashboard)
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined session matrix: ${roomId}`);
  });

  // 2. Bounce the whiteboard data to the other user
  socket.on("canvas_sync", (data) => {
    // socket.to() sends it to everyone in the room EXCEPT the sender
    socket.to(data.roomId).emit("canvas_sync", data.changes);
  });

  // ==========================================
  // 🛑 DISCONNECT LOGIC
  // ==========================================
  socket.on('disconnect', () => {
    console.log(`🛑 Disconnected: ${socket.id}`);
  });
});

// 🚨 5. START THE SERVER using `server.listen`, NOT `app.listen`
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Hybrid HTTP/Socket Server booting on port ${PORT}`);
  });
}

// Exported so tests (supertest / socket.io-client) can use the app without opening a port
module.exports = { app, server, io };