// controllers/escrowController.js
const Session = require('../models/Session');
const User = require('../models/User');

// 1. MARK AS COMPLETE (The Two-Key System)
exports.markSessionComplete = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user._id;

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.status !== 'pending' && session.status !== 'active') {
            return res.status(400).json({ message: "Session is not active." });
        }

        // Determine role and sign off
        if (session.hostId.toString() === userId.toString()) {
            session.hostCompleted = true; // ✅ FIXED: hostCompleted
        } else if (session.learnerId.toString() === userId.toString()) {
            session.learnerCompleted = true;
        }

        // Check if BOTH have signed off
        if (session.hostCompleted && session.learnerCompleted) {
            session.status = 'completed';

            // 🚨 THE PAYOUT: Move tokens from Learner to Host
            const learner = await User.findById(session.learnerId);
            const host = await User.findById(session.hostId);

            // Deduct from Learner, Add to Host
            learner.walletBalance -= session.escrowAmount;
            host.walletBalance += session.escrowAmount;

            await learner.save();
            await host.save();
        }

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: "Failed to update escrow", error: error.message });
    }
};

// 2. RAISE DISPUTE
exports.raiseDispute = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { reason } = req.body;
        const userId = req.user._id;

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        // Freeze the contract
        session.status = 'disputed';
        session.disputeReason = `Disputed by ${req.user.username}: ${reason}`;

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: "Failed to dispute session", error: error.message });
    }
};