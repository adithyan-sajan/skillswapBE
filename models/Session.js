const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillListing', required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  learnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostCompleted: { type: Boolean, default: false },
  learnerCompleted: { type: Boolean, default: false },
  disputeReason: { type: String },
  // Escrow & Economy
  escrowAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'disputed', 'cancelled'],
    default: 'pending'
  },

  // Scheduling & Connection
  scheduledStartTime: { type: Date },
  roomId: { type: String, unique: true }, // For the WebRTC/WebSocket connection

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);