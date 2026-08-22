// controllers/adminController.js
// S9: Admin-only controller for user management and dispute resolution
const User = require('../models/User');
const Session = require('../models/Session');

// 1. GET ALL USERS (admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// 2. DELETE USER (admin)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
};

// 3. RESOLVE DISPUTE (admin)
exports.resolveDispute = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { decision, reason } = req.body; // decision: 'release_to_learner' | 'release_to_host'

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.status !== 'disputed') {
      return res.status(400).json({ message: "Session is not in dispute" });
    }

    // S9: Admin resolves the dispute with their chosen payout direction
    session.status = 'completed';
    session.disputeReason = `Resolved by admin (${req.user.username}): ${decision} — ${reason || ''}`;
    await session.save();

    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve dispute" });
  }
};
