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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Attach the user to the request
    req.user = await User.findById(decoded.id).select('-passwordHash');
    
    return next(); // Pass to the controller safely
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, session expired or invalid' });
  }
};

module.exports = { checkAuth };