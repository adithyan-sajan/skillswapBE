// controllers/chatController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Fetch all messages for a specific chat room
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
};