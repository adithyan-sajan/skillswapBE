const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // CORE AUTH
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  
  // THE WALLET (Critical for Escrow)
  walletBalance: { type: Number, default: 5.00 }, // Start users with 5 SKL
  
  // PUBLIC IDENTITY (What the new modal updates)
  avatarUrl: { type: String, default: "" },
  bio: { type: String, default: "", maxLength: 250 },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  
  socials: {
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    twitter: { type: String, default: "" }
  },
  
  // SKILL ARRAYS
  skillsOffered: [{ type: String }],
  skillsDesired: [{ type: String }],
  
  // GAMIFICATION & STATS
  rating: { type: Number, default: 5.0 },
  totalSessionsCompleted: { type: Number, default: 0 },
  hoursTaught: { type: Number, default: 0 },
  hoursLearned: { type: Number, default: 0 },
  rank: { type: String, default: "New Member" },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);