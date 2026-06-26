const mongoose = require('mongoose');

const skillListingSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    required: true,
    enum: ['languages', 'tech', 'creative', 'business', 'misc'] 
  },
  description: { type: String, required: true },
  level: { 
    type: String, 
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  costPerHour: { type: Number, required: true, min: 0.1 },
  isActive: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now }
});

// We name the model 'SkillListing'
module.exports = mongoose.model('SkillListing', skillListingSchema);