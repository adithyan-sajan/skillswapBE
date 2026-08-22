// controllers/chatController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// 1. Fetch all chat rooms for the logged-in user
exports.getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate('participants', 'username avatarUrl') // Get peer info
    .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

// 2. Fetch the message history for a specific room
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // S3: IDOR protection — only participants may read message history
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this conversation." });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
};