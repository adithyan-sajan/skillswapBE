// routes/adminRoutes.js
// S9: Admin routes — protected by checkAuth + checkAdmin
const express = require('express');
const router = express.Router();
const { checkAuth, checkAdmin } = require('../middleware/authMiddleware');
const { getAllUsers, deleteUser, resolveDispute } = require('../controllers/adminController');

// User management
router.get('/users', checkAuth, checkAdmin, getAllUsers);
router.delete('/users/:id', checkAuth, checkAdmin, deleteUser);

// Dispute resolution (escrow)
router.patch('/escrow/:sessionId/resolve', checkAuth, checkAdmin, resolveDispute);

module.exports = router;
