const mongoose = require('mongoose');

const tradeRequestSchema = new mongoose.Schema({
  skillListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillListing', required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seekerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed'], 
    default: 'pending' 
  },
  
  message: { type: String, maxlength: 500 }, // The note sent with the request
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TradeRequest', tradeRequestSchema);