const express = require('express');
const router = express.Router();
const { checkAuth } = require('../middleware/authMiddleware');
const { createSession, getMySessions } = require('../controllers/sessionController');

router.post('/', checkAuth, createSession);
router.get('/me', checkAuth, getMySessions);

module.exports = router;