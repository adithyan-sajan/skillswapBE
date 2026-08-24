// Group E: admin dispute resolution (adminController.resolveDispute)
const request = require('supertest');
const { app } = require('../index');
const User = require('../models/User');
const Session = require('../models/Session');
const { connectDb, cleanDb, disconnectDb } = require('./helpers/db');
const {
  createUser,
  createListing,
  createAcceptedSwap,
  createSession,
  authCookie,
} = require('./helpers/factories');

beforeAll(async () => {
  await connectDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('PATCH /api/admin/escrow/:sessionId/resolve', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  // Builds a disputed session with known balances:
  // learner L, host H, escrow E.
  async function setupDisputed() {
    const admin = await createUser({ walletBalance: 1000, role: 'admin' });
    const host = await createUser({ walletBalance: 30 });
    const learner = await createUser({ walletBalance: 50 });
    const listing = await createListing(host);
    await createAcceptedSwap(listing, learner, host);
    const session = await createSession({
      listing,
      host,
      learner,
      escrowAmount: 5,
      overrides: { status: 'disputed', disputeReason: 'Disputed by test: no-show' },
    });
    return { admin, host, learner, session };
  }

  // E1 — today's fix locked: release_to_host actually moves the tokens
  test('release_to_host -> completed and payout actually happened (learner L-E, host H+E)', async () => {
    const { admin, host, learner, session } = await setupDisputed();

    const res = await request(app)
      .patch(`/api/admin/escrow/${session._id}/resolve`)
      .set('Cookie', authCookie(admin))
      .send({ decision: 'release_to_host', reason: 'host delivered' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');

    const learnerAfter = await User.findById(learner._id);
    const hostAfter = await User.findById(host._id);
    expect(learnerAfter.walletBalance).toBeCloseTo(45); // 50 - 5
    expect(hostAfter.walletBalance).toBeCloseTo(35); // 30 + 5

    // Dispute reason overwritten with the resolution record
    const reloaded = await Session.findById(session._id);
    expect(reloaded.disputeReason).toContain(admin.username);
    expect(reloaded.disputeReason).toContain('release_to_host');
  });

  // E2 — today's fix locked: funds were never debited pre-dispute, so
  // release_to_learner must NOT touch any balance
  test('release_to_learner -> completed with NO balance changes', async () => {
    const { admin, host, learner, session } = await setupDisputed();

    const res = await request(app)
      .patch(`/api/admin/escrow/${session._id}/resolve`)
      .set('Cookie', authCookie(admin))
      .send({ decision: 'release_to_learner', reason: 'learner was right' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');

    const learnerAfter = await User.findById(learner._id);
    const hostAfter = await User.findById(host._id);
    expect(learnerAfter.walletBalance).toBeCloseTo(50); // untouched
    expect(hostAfter.walletBalance).toBeCloseTo(30); // untouched
  });

  // E3 — today's fix: invalid / missing decision is rejected naming the valid options
  test.each([
    ['invalid decision value', { decision: 'split_it' }],
    ['missing decision', {}],
  ])('%s -> 400 message names both valid decisions', async (_name, body) => {
    const { admin, session } = await setupDisputed();

    const res = await request(app)
      .patch(`/api/admin/escrow/${session._id}/resolve`)
      .set('Cookie', authCookie(admin))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("'release_to_host'");
    expect(res.body.message).toContain("'release_to_learner'");

    // Still in dispute — a bad call must not silently settle it
    const reloaded = await Session.findById(session._id);
    expect(reloaded.status).toBe('disputed');
  });

  // E4
  test('non-admin user on the admin route -> 403 Admin access required.', async () => {
    const { learner, session } = await setupDisputed();

    const res = await request(app)
      .patch(`/api/admin/escrow/${session._id}/resolve`)
      .set('Cookie', authCookie(learner))
      .send({ decision: 'release_to_host' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admin access required.');

    // Session untouched by the unauthorized attempt
    const reloaded = await Session.findById(session._id);
    expect(reloaded.status).toBe('disputed');
  });

  // E5
  test('resolving a pending (non-disputed) session -> 400 Session is not in dispute', async () => {
    const admin = await createUser({ walletBalance: 1000, role: 'admin' });
    const host = await createUser({ walletBalance: 30 });
    const learner = await createUser({ walletBalance: 50 });
    const listing = await createListing(host);
    await createAcceptedSwap(listing, learner, host);
    const session = await createSession({
      listing,
      host,
      learner,
      escrowAmount: 5,
      overrides: { status: 'pending' },
    });

    const res = await request(app)
      .patch(`/api/admin/escrow/${session._id}/resolve`)
      .set('Cookie', authCookie(admin))
      .send({ decision: 'release_to_host', reason: 'premature' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Session is not in dispute');
  });

  // E6
  test('unknown sessionId -> 404 Session not found', async () => {
    const admin = await createUser({ walletBalance: 1000, role: 'admin' });
    const fakeId = require('mongoose').Types.ObjectId.createFromTime(77);

    const res = await request(app)
      .patch(`/api/admin/escrow/${fakeId}/resolve`)
      .set('Cookie', authCookie(admin))
      .send({ decision: 'release_to_host', reason: 'ghost' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Session not found');
  });
});
