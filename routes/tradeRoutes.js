const express = require('express');
const router = express.Router();
const { createRequest } = require('../controllers/tradeController');
const { checkAuth } = require('../middleware/authMiddleware');

router.post('/', checkAuth, createRequest);

module.exports = router;