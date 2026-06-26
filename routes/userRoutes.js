const express = require('express');
const router = express.Router();
const { checkAuth } = require('../middleware/authMiddleware');
const { getProfile, updateProfile } = require('../controllers/userController');

router.get('/', checkAuth, getProfile)
router.patch('/', checkAuth, updateProfile)
module.exports = router;