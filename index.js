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

// 🚨 4. THE SOCKET.IO ENGINE
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // When a user opens a specific chat UI, they "join" that conversation's room
  socket.on('join_chat', (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined room: ${conversationId}`);
  });

  // When a user sends a message from the React UI
  socket.on('send_message', async (data) => {
    // data should look like: { conversationId, senderId, text }
    
    // 1. Broadcast the message to the other person in the room immediately
    io.to(data.conversationId).emit('receive_message', data);

    // 2. Save it to MongoDB in the background
    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');
      
      const newMessage = await Message.create(data);
      
      // Update the conversation's "lastMessage" for the inbox preview
      await Conversation.findByIdAndUpdate(data.conversationId, { 
        lastMessage: newMessage._id 
      });
    } catch (err) {
      console.error("Failed to save message to DB", err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🛑 Disconnected: ${socket.id}`);
  });
});

// 🚨 5. START THE SERVER using `server.listen`, NOT `app.listen`
server.listen(PORT, () => {
  console.log(`🚀 Hybrid HTTP/Socket Server booting on port ${PORT}`);
});