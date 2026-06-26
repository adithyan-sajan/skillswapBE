// controllers/sessionController.js
const Session = require('../models/Session');
const SkillListing = require('../models/SkillListing'); // Adjust if your model is named 'Skill'
const crypto = require('crypto');

// 1. CREATE A NEW SESSION
exports.createSession = async (req, res) => {
    try {
        const { peerId, skillId, scheduledStartTime, durationHours = 1 } = req.body;
        const userId = req.user._id;

        // Fetch the listing to get the cost for the Escrow
        const listing = await SkillListing.findById(skillId);
        if (!listing) return res.status(404).json({ message: "Skill listing not found" });

        // Figure out who is the host and who is the learner
        const isHost = listing.hostId.toString() === userId.toString();
        const hostId = isHost ? userId : peerId;
        const learnerId = isHost ? peerId : userId;

        // Calculate Escrow Economy
        const escrowAmount = (listing.costPerHour || 0) * durationHours;

        // Generate a unique Room ID for their future video/workspace connection
        const roomId = `room_${crypto.randomBytes(6).toString('hex')}`;

        const newSession = await Session.create({
            skillId,
            hostId,
            learnerId,
            escrowAmount,
            scheduledStartTime,
            roomId,
            status: 'pending'
        });

        res.status(201).json(newSession);
    } catch (error) {
        res.status(500).json({ message: "Failed to schedule session", error: error.message });
    }
};

// 2. GET MY UPCOMING SESSIONS
exports.getMySessions = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find sessions where the user is either the host or the learner
        const sessions = await Session.find({
            $or: [{ hostId: userId }, { learnerId: userId }],
            status: { $in: ['pending', 'active'] } // Only show upcoming/live ones
        })
            .populate('hostId', 'username avatarUrl')
            .populate('learnerId', 'username avatarUrl')
            .populate('skillId', 'title costPerHour')
            .sort({ scheduledStartTime: 1 }); // Sort by soonest first

        res.status(200).json(sessions);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sessions" });
        console.log(error)
    }
};