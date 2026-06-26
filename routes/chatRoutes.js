const express = require('express');
const { getMessages } = require('../controllers/chatController');
const router = express.Router();

router.get('/:conversationId', checkAuth, getMessages)
module.exports = router;