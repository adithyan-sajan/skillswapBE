const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const SkillListing = require('../../models/SkillListing');
const SwapRequest = require('../../models/SwapRequest');
const Session = require('../../models/Session');

let counter = 0;
function uniq(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * Create a real User doc. All schema-required fields are explicit.
 * @param {{ walletBalance?: number, role?: 'member'|'admin', overrides?: object }} [opts]
 */
async function createUser({ walletBalance = 100.0, role = 'member', overrides = {} } = {}) {
  const password = 'Password123!';
  const user = await User.create({
    username: uniq('user'),
    email: `${uniq('u')}@test.local`,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    walletBalance,
    ...overrides,
  });
  // Stash the plaintext password so tests can log in through /api/auth/login if needed.
  user._plainPassword = password;
  return user;
}

/**
 * Create a real SkillListing owned by `user`.
 * @param {object} user - saved User doc (host)
 * @param {{ overrides?: object }} [opts]
 */
async function createListing(user, { overrides = {} } = {}) {
  return SkillListing.create({
    hostId: user._id,
    title: `Guitar basics ${uniq()}`,
    category: 'creative',
    description: 'A test listing created by the factory.',
    level: 'Beginner',
    costPerHour: 2.5,
    ...overrides,
  });
}

/**
 * Accepted swap request from sender -> receiver on listing.
 * Status 'Accepted' matches the enum in models/SwapRequest.js.
 */
async function createAcceptedSwap(listing, sender, receiver) {
  return SwapRequest.create({
    senderId: sender._id,
    receiverId: receiver._id,
    listingId: listing._id,
    status: 'Accepted',
    message: 'factory-created accepted swap',
  });
}

/**
 * @param {{ listing: object, host: object, learner: object, escrowAmount?: number, overrides?: object }} opts
 */
async function createSession({ listing, host, learner, escrowAmount = 5.0, overrides = {} }) {
  const session = await Session.create({
    skillId: listing._id,
    hostId: host._id,
    learnerId: learner._id,
    escrowAmount,
    status: 'active',
    roomId: `room-${uniq()}`, // unique — schema has a unique index on roomId
    scheduledStartTime: new Date(),
    ...overrides,
  });
  return session;
}

/**
 * Build the auth cookie value the API expects (`req.cookies.jwt`).
 * Token payload mirrors what the app signs: `{ id, type: 'access' }`.
 * @param {object} user - saved User doc
 * @returns {string} e.g. "jwt=eyJ..."
 */
function authCookie(user) {
  const token = jwt.sign(
    { id: user._id.toString(), type: 'access' },
    process.env.JWT_ACCESS_SECRET
  );
  return `jwt=${token}`;
}

module.exports = {
  createUser,
  createListing,
  createAcceptedSwap,
  createSession,
  authCookie,
};
