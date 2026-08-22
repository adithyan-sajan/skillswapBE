// controllers/sessionController.js
const mongoose = require('mongoose');
const Session = require('../models/Session');
const SkillListing = require('../models/SkillListing');
const User = require('../models/User');
const SwapRequest = require('../models/SwapRequest');
const crypto = require('crypto');

// 1. CREATE A NEW SESSION
exports.createSession = async (req, res) => {
    try {
        const { peerId, skillId, scheduledStartTime, durationHours = 1 } = req.body;
        const userId = req.user._id;

        // S2: Validate durationHours — must be a positive number, cap to a sane max
        const duration = Number(durationHours);
        if (isNaN(duration) || duration <= 0 || duration > 24) {
            return res.status(400).json({ message: "durationHours must be a positive number (max 24)." });
        }

        // S7: Validate peerId — must be a valid ObjectId and not the caller themselves
        if (!mongoose.Types.ObjectId.isValid(peerId)) {
            return res.status(400).json({ message: "Invalid peerId." });
        }
        if (peerId.toString() === userId.toString()) {
            return res.status(400).json({ message: "Cannot schedule a session with yourself." });
        }

        // Fetch the listing to get the cost for the Escrow
        const listing = await SkillListing.findById(skillId);
        if (!listing) return res.status(404).json({ message: "Skill listing not found" });

        // Figure out who is the host and who is the learner
        const isHost = listing.hostId.toString() === userId.toString();
        if (!isHost && peerId.toString() !== listing.hostId.toString()) {
            // If the current user is not the host, the peer must be the host
            return res.status(400).json({ message: "peerId must be the host of the listing." });
        }
        const hostId = isHost ? userId : peerId;
        const learnerId = isHost ? peerId : userId;

        // S7: Consent check — require an accepted swap request between the two users for this listing
        const hasAcceptedRequest = await SwapRequest.findOne({
            listingId: skillId,
            status: 'Accepted',
            $or: [
                { senderId: userId, receiverId: peerId },
                { senderId: peerId, receiverId: userId }
            ]
        }).lean();
        if (!hasAcceptedRequest) {
            return res.status(403).json({ message: "No accepted request exists between you and this peer for this skill." });
        }

        // S2: Learner balance check — prevent creating sessions they can't afford
        if (!isHost) {
            // The current user is the learner — req.user is the full User doc (loaded by checkAuth)
            if (req.user.walletBalance < (listing.costPerHour || 0) * duration) {
                return res.status(400).json({ message: "Insufficient wallet balance for escrow." });
            }
        } else {
            // The peer is the learner — check their balance
            const peer = await User.findById(peerId);
            if (!peer) return res.status(404).json({ message: "Peer user not found." });
            if (peer.walletBalance < (listing.costPerHour || 0) * duration) {
                return res.status(400).json({ message: "Peer has insufficient wallet balance for escrow." });
            }
        }

        // Calculate Escrow Economy
        const escrowAmount = (listing.costPerHour || 0) * duration;

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
        // S10: Don't leak internal error details to the client
        res.status(500).json({ message: "Failed to schedule session" });
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