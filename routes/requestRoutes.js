// routes/requestRoutes.js
const express = require('express');
const router = express.Router();
const { checkAuth } = require('../middleware/authMiddleware');
const { createRequest, getMyRequests, updateRequestStatus } = require('../controllers/requestController');

router.post('/', checkAuth, createRequest);
router.get('/me', checkAuth, getMyRequests);
router.patch('/:requestId', checkAuth, updateRequestStatus);

module.exports = router;