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
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Must match your React app
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('⚡ Connected to MongoDB Matrix'))
  .catch((err) => console.error('Database error:', err));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/listings', require('./routes/listingRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/escrow', require('./routes/escrowRoutes'));

// 🚨 4. THE SOCKET.IO ENGINE
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // ==========================================
  // 💬 CHAT SYSTEM LOGIC
  // ==========================================
  socket.on('join_chat', (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined chat room: ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    io.to(data.conversationId).emit('receive_message', data);

    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');
      
      const newMessage = await Message.create(data);
      
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
server.listen(PORT, () => {
  console.log(`🚀 Hybrid HTTP/Socket Server booting on port ${PORT}`);
});