// routes/escrowRoutes.js
const express = require('express');
const router = express.Router();
const { checkAuth } = require('../middleware/authMiddleware');
const { markSessionComplete, raiseDispute } = require('../controllers/escrowController');

router.patch('/:sessionId/complete', checkAuth, markSessionComplete);
router.patch('/:sessionId/dispute', checkAuth, raiseDispute);

module.exports = router;