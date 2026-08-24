// Group D: dispute flow (escrowController.raiseDispute)
const request = require('supertest');
const { app } = require('../index');
const Session = require('../models/Session');
const User = require('../models/User');
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

describe('POST /api/escrow/:sessionId/dispute', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  async function setup({ sessionOverrides = {} } = {}) {
    const host = await createUser({ walletBalance: 100 });
    const learner = await createUser({ walletBalance: 80 });
    const listing = await createListing(host);
    await createAcceptedSwap(listing, learner, host);
    const session = await createSession({
      listing,
      host,
      learner,
      escrowAmount: 5,
      overrides: sessionOverrides,
    });
    return { host, learner, listing, session };
  }

  // D1
  test.each(['pending', 'active'])(
    'participant can dispute a %s session -> frozen with reason naming user + cause',
    async (status) => {
      const { learner, session } = await setup({
        sessionOverrides: { status },
      });

      const res = await request(app)
        .patch(`/api/escrow/${session._id}/dispute`)
        .set('Cookie', authCookie(learner))
        .send({ reason: 'host never showed up' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('disputed');
      expect(res.body.disputeReason).toContain(learner.username);
      expect(res.body.disputeReason).toContain('host never showed up');
    }
  );

  // D2 — THE CORE INVARIANT: freeze blocks completion for BOTH parties
  test('after a dispute, neither party can mark complete and balances are unchanged', async () => {
    const { host, learner, session } = await setup();

    const disputeRes = await request(app)
      .patch(`/api/escrow/${session._id}/dispute`)
      .set('Cookie', authCookie(learner))
      .send({ reason: 'quality concerns' });
    expect(disputeRes.status).toBe(200);

    for (const party of [learner, host]) {
      const res = await request(app)
        .patch(`/api/escrow/${session._id}/complete`)
        .set('Cookie', authCookie(party));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Session is not active.');
    }

    // Escrow must still be locked: no payout moved any tokens
    const learnerAfter = await User.findById(learner._id);
    const hostAfter = await User.findById(host._id);
    expect(learnerAfter.walletBalance).toBeCloseTo(80);
    expect(hostAfter.walletBalance).toBeCloseTo(100);
  });

  // D3 — regression lock for today's fix: already-paid sessions cannot be disputed
  test('disputing an already-completed (paid) session is rejected -> no double-payout window', async () => {
    const { host, learner, session } = await setup({
      sessionOverrides: { status: 'completed' },
    });

    for (const party of [learner, host]) {
      const res = await request(app)
        .patch(`/api/escrow/${session._id}/dispute`)
        .set('Cookie', authCookie(party))
        .send({ reason: 'changed my mind' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Session is not active.');
    }

    // Session stays completed, untouched
    const reloaded = await Session.findById(session._id);
    expect(reloaded.status).toBe('completed');

    // Balances unchanged by the rejected attempts
    expect((await User.findById(learner._id)).walletBalance).toBeCloseTo(80);
    expect((await User.findById(host._id)).walletBalance).toBeCloseTo(100);

    void host; // both parties exercised above via loop
  });

  // D4
  test('disputing a cancelled session is rejected by the same guard', async () => {
    const { learner, session } = await setup({
      sessionOverrides: { status: 'cancelled' },
    });

    const res = await request(app)
      .patch(`/api/escrow/${session._id}/dispute`)
      .set('Cookie', authCookie(learner))
      .send({ reason: 'refund please' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Session is not active.');
  });

  // D5
  test('non-participant cannot dispute -> 403', async () => {
    const { session } = await setup();
    const outsider = await createUser({ walletBalance: 10 });

    const res = await request(app)
      .patch(`/api/escrow/${session._id}/dispute`)
      .set('Cookie', authCookie(outsider))
      .send({ reason: 'not my business' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not a participant in this session.');

    // Not frozen either
    const reloaded = await Session.findById(session._id);
    expect(reloaded.status).toBe('active');
  });
});
