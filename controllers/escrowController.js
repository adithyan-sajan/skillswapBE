// controllers/escrowController.js
const mongoose = require('mongoose');
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

        // S1: Participant authorization — only host or learner may sign off
        if (session.hostId.toString() !== userId.toString() && session.learnerId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not a participant in this session." });
        }

        // Determine role and sign off
        if (session.hostId.toString() === userId.toString()) {
            session.hostCompleted = true;
        } else if (session.learnerId.toString() === userId.toString()) {
            session.learnerCompleted = true;
        }

        // Check if BOTH have signed off
        if (session.hostCompleted && session.learnerCompleted) {
            session.status = 'completed';

            // 🚨 THE PAYOUT: Move tokens from Learner to Host
            // S5: Wrap payout in a Mongo transaction for atomicity
            const payoutSession = await mongoose.startSession();
            payoutSession.startTransaction();

            try {
                const learner = await User.findById(session.learnerId).session(payoutSession);
                const host = await User.findById(session.hostId).session(payoutSession);

                // Deduct from Learner, Add to Host
                learner.walletBalance -= session.escrowAmount;
                host.walletBalance += session.escrowAmount;

                await learner.save({ session: payoutSession });
                await host.save({ session: payoutSession });

                await payoutSession.commitTransaction();
            } catch (err) {
                await payoutSession.abortTransaction();
                throw err;
            } finally {
                payoutSession.endSession();
            }
        }

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        // S10: Don't leak internal error details to the client
        res.status(500).json({ message: "Failed to update escrow" });
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

        // S1: Participant authorization — only host or learner may dispute
        if (session.hostId.toString() !== userId.toString() && session.learnerId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not a participant in this session." });
        }

        // Freeze the contract
        session.status = 'disputed';
        session.disputeReason = `Disputed by ${req.user.username}: ${reason}`;

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        // S10: Don't leak internal error details to the client
        res.status(500).json({ message: "Failed to dispute session" });
    }
};