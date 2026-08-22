// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const checkAuth = async (req, res, next) => {
  // 1. Grab the token directly from the cookies (we named it 'jwt' in authController)
  const token = req.cookies?.jwt;

  // 2. Shield: If there is no token cookie, stop immediately
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no session cookie found' });
  }

  try {
    // 3. Verify the cookie token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // S6: Reject refresh tokens at access-token middleware — only access tokens allowed here
    if (decoded.type !== 'access') {
      return res.status(401).json({ message: 'Not authorized, use the access token' });
    }

    // 4. Attach the user to the request
    req.user = await User.findById(decoded.id).select('-passwordHash');
    
    return next(); // Pass to the controller safely
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, session expired or invalid' });
  }
};

// S9: Admin-only middleware — requires an authenticated user with role 'admin'
const checkAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

module.exports = { checkAuth, checkAdmin };