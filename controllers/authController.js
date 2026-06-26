const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper Generators
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' }); // 15 minutes!
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' }); // 7 days!
};

// Reusable function to attach the cookie
const sendTokenResponse = (user, statusCode, res) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Lock the refresh token inside an httpOnly cookie
  res.cookie('jwt', refreshToken, {
    httpOnly: true, // Javascript cannot access this
    secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
    sameSite: 'strict', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  });

  // Send the user data and short-lived access token back to React
  res.status(statusCode).json({
    _id: user._id,
    username: user.username,
    email: user.email,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl,
    accessToken // Note: We changed the name from 'token' to 'accessToken'
  });
};

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    
    if (userExists) return res.status(400).json({ message: 'User or email already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      passwordHash: hashedPassword,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      sendTokenResponse(user, 200, res);
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

// NEW: The Silent Refresh Endpoint
exports.refresh = async (req, res) => {
  // 1. Check if the browser sent the cookie
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized, no cookie' });

  const refreshToken = cookies.jwt;

  try {
    // 2. Verify the cookie is real and not expired
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // 3. Find the user
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) return res.status(401).json({ message: 'Unauthorized, user not found' });

    // 4. Issue a brand new Access Token!
    const accessToken = generateAccessToken(user._id);
    
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      walletBalance: user.walletBalance,
      avatarUrl: user.avatarUrl,
      accessToken
    });
  } catch (error) {
    res.status(403).json({ message: 'Forbidden, token failed' });
  }
};

// NEW: Logout Endpoint (Clears the cookie)
exports.logoutUser = (req, res) => {
  res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: 'Logged out successfully' });
};