// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { checkAuth } = require('../middleware/authMiddleware');
const { getMyConversations, getMessages } = require('../controllers/chatController');

router.get('/conversations', checkAuth, getMyConversations);
router.get('/:conversationId', checkAuth, getMessages);

module.exports = router;