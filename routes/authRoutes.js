const express = require('express');
const router = express.Router();
const { registerUser, loginUser, refresh, logoutUser } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/refresh', refresh); // The silent refresh endpoint
router.post('/logout', logoutUser); // Clears the cookie

module.exports = router;