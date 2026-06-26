const express = require('express');
const router = express.Router();
const { createListing, getMyListings, getAllListings } = require('../controllers/listingController');
// Import your JWT middleware (adjust the path if yours is named differently)
const { checkAuth } = require('../middleware/authMiddleware'); 

// Dashboard & Profile Routes
router.post('/', checkAuth, createListing);
router.get('/me', checkAuth, getMyListings);

// Explore Page Route
router.get('/', checkAuth, getAllListings);

module.exports = router;