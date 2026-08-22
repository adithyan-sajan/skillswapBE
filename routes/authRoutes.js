const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { registerUser, loginUser, refresh, logoutUser } = require('../controllers/authController');

// S8: Rate-limit auth endpoints to blunt brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/refresh', refresh); // The silent refresh endpoint
router.post('/logout', authLimiter, logoutUser); // Clears the cookie

module.exports = router;