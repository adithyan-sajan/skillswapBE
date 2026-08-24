const request = require('supertest');
const { app } = require('../index');
const Session = require('../models/Session');
const SwapRequest = require('../models/SwapRequest');
const { connectDb, cleanDb, disconnectDb } = require('./helpers/db');
const {
  createUser,
  createListing,
  createAcceptedSwap,
  createSession,
  authCookie,
} = require('./helpers/factories');

// Factory listing costPerHour is 2.5 — pin the arithmetic expectations to it.
const COST_PER_HOUR = 2.5;

beforeAll(async () => {
  await connectDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/sessions — createSession validation guards', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  function postSession(actor, body) {
    return request(app)
      .post('/api/sessions')
      .set('Cookie', authCookie(actor))
      .send(body);
  }

  // Standard fixture: host owns the listing, an Accepted swap exists between
  // host and learner, so only the guard under test can reject the call.
  async function arrangeAcceptedPair({ learnerBalance = 1000, hostBalance = 1000 } = {}) {
    const host = await createUser({ walletBalance: hostBalance });
    const learner = await createUser({ walletBalance: learnerBalance });
    const listing = await createListing(host);
    await createAcceptedSwap(listing, learner, host);
    return { host, learner, listing };
  }

  describe('C1: durationHours validation', () => {
    test.each([0, -2, 'abc', 25])(
      'rejects durationHours=%p with 400 and creates no Session',
      async (badDuration) => {
        const { host, learner, listing } = await arrangeAcceptedPair();

        const res = await postSession(learner, {
          peerId: host._id.toString(),
          skillId: listing._id.toString(),
          scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
          durationHours: badDuration,
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('durationHours');
        expect(res.body.message).toContain('positive number');
        expect(res.body.message).toMatch(/max 24/i);
        expect(await Session.countDocuments()).toBe(0);
      }
    );
  });

  describe('C2: upper boundary durationHours=24 is accepted', () => {
    test('accepts 24 hours and escrows costPerHour * 24', async () => {
      const { host, learner, listing } = await arrangeAcceptedPair();

      const res = await postSession(learner, {
        peerId: host._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        durationHours: 24,
      });

      expect(res.status).toBe(201);
      expect(res.body.escrowAmount).toBeCloseTo(COST_PER_HOUR * 24, 6);

      const saved = await Session.findOne({ _id: res.body._id });
      expect(saved).not.toBeNull();
      expect(saved.escrowAmount).toBeCloseTo(COST_PER_HOUR * 24, 6);
    });
  });

  describe('C3: fractional durationHours is prorated', () => {
    // Documented intended behavior: escrowAmount scales linearly with the
    // fractional duration (costPerHour * duration), not rounded to whole hours.
    test('accepts 1.5 hours and prorates escrowAmount to costPerHour * 1.5', async () => {
      const { host, learner, listing } = await arrangeAcceptedPair();

      const res = await postSession(learner, {
        peerId: host._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        durationHours: 1.5,
      });

      expect(res.status).toBe(201);
      expect(res.body.escrowAmount).toBeCloseTo(COST_PER_HOUR * 1.5, 6); // 3.75

      const saved = await Session.findOne({ _id: res.body._id });
      expect(saved.escrowAmount).toBeCloseTo(3.75, 6);
    });
  });

  describe('C4: omitted durationHours defaults to 1 hour', () => {
    test('defaults escrowAmount to costPerHour when durationHours is absent', async () => {
      const { host, learner, listing } = await arrangeAcceptedPair();

      const res = await postSession(learner, {
        peerId: host._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        // no durationHours
      });

      expect(res.status).toBe(201);
      expect(res.body.escrowAmount).toBeCloseTo(COST_PER_HOUR, 6); // 2.5

      const saved = await Session.findOne({ _id: res.body._id });
      expect(saved.escrowAmount).toBeCloseTo(COST_PER_HOUR, 6);
    });
  });

  describe('C5: learner without sufficient walletBalance', () => {
    test('rejects caller-as-learner with insufficient funds and creates no Session', async () => {
      const { host, learner, listing } = await arrangeAcceptedPair({
        learnerBalance: 1, // < costPerHour * 1
      });

      const res = await postSession(learner, {
        peerId: host._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        durationHours: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Insufficient wallet balance for escrow.');
      expect(await Session.countDocuments()).toBe(0);
    });
  });

  describe('C6: host-initiated session with broke peer', () => {
    test("rejects when the peer (learner) can't cover escrow", async () => {
      const { host, learner, listing } = await arrangeAcceptedPair({
        learnerBalance: 0.5, // peer is broke
      });

      const res = await postSession(host, {
        peerId: learner._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        durationHours: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Peer has insufficient wallet balance for escrow.');
      expect(await Session.countDocuments()).toBe(0);
    });
  });
});

describe('POST /api/sessions — peerId / consent guards', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  function postSession(actor, body) {
    return request(app)
      .post('/api/sessions')
      .set('Cookie', authCookie(actor))
      .send(body);
  }

  async function arrangeBase() {
    const host = await createUser({ walletBalance: 1000 });
    const learner = await createUser({ walletBalance: 1000 });
    const stranger = await createUser({ walletBalance: 1000 });
    const listing = await createListing(host);
    return { host, learner, stranger, listing };
  }

  function validBody(listing, peerId) {
    return {
      peerId: peerId ? peerId.toString() : undefined,
      skillId: listing._id.toString(),
      scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
      durationHours: 1,
    };
  }

  describe('F1: invalid or missing peerId', () => {
    test.each([
      ['garbage string', 'garbage'],
      ['missing (undefined)', undefined],
    ])('rejects %s with 400 Invalid peerId', async (_label, peerId) => {
      const { host, learner, listing } = await arrangeBase();

      const res = await postSession(learner, validBody(listing, peerId));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid peerId.');
      expect(await Session.countDocuments()).toBe(0);
    });
  });

  describe('F2: peerId equal to self', () => {
    test('rejects scheduling a session with yourself', async () => {
      const { host, learner, listing } = await arrangeBase();

      const res = await postSession(learner, validBody(listing, learner._id));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot schedule a session with yourself.');
      expect(await Session.countDocuments()).toBe(0);
    });
  });

  describe('F3: consent requires an Accepted swap request', () => {
    test('403 without one; succeeds once an accepted swap exists', async () => {
      const { host, learner, listing } = await arrangeBase();

      const denied = await postSession(learner, validBody(listing, host._id));
      expect(denied.status).toBe(403);
      expect(denied.body.message).toContain('No accepted request exists');

      await createAcceptedSwap(listing, learner, host);

      const allowed = await postSession(learner, validBody(listing, host._id));
      expect(allowed.status).toBe(201);
      expect(await Session.countDocuments()).toBe(1);
    });
  });

  describe('F4: Pending swap request does not grant consent', () => {
    test('rejects when the only swap request is still Pending', async () => {
      const { host, learner, listing } = await arrangeBase();
      await SwapRequest.create({
        senderId: learner._id,
        receiverId: host._id,
        listingId: listing._id,
        status: 'Pending',
      });

      const res = await postSession(learner, validBody(listing, host._id));

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('No accepted request exists');
      expect(await Session.countDocuments()).toBe(0);
    });
  });

  describe('F5: non-host caller must target the listing host', () => {
    test('rejects peerId pointing at a third party', async () => {
      const { host, learner, stranger, listing } = await arrangeBase();

      const res = await postSession(learner, validBody(listing, stranger._id));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('peerId must be the host of the listing.');
      expect(await Session.countDocuments()).toBe(0);
    });
  });

  describe('F6: role assignment both directions', () => {
    test('learner-initiated stores hostId=peer, learnerId=caller', async () => {
      const { host, learner, listing } = await arrangeBase();
      await createAcceptedSwap(listing, learner, host);

      const res = await postSession(learner, validBody(listing, host._id));

      expect(res.status).toBe(201);
      expect(res.body.hostId.toString()).toBe(host._id.toString());
      expect(res.body.learnerId.toString()).toBe(learner._id.toString());
      expect(res.body.status).toBe('pending');
      expect(res.body.roomId).toMatch(/^room_/);
    });

    test('host-initiated reversed: hostId=caller, learnerId=peer', async () => {
      const { host, learner, listing } = await arrangeBase();
      await createAcceptedSwap(listing, learner, host);

      const res = await postSession(host, validBody(listing, learner._id));

      expect(res.status).toBe(201);
      expect(res.body.hostId.toString()).toBe(host._id.toString());
      expect(res.body.learnerId.toString()).toBe(learner._id.toString());
      expect(res.body.status).toBe('pending');
      expect(res.body.roomId).toMatch(/^room_/);
    });
  });
});

describe('GET /api/sessions/me — getMySessions scoping', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test('F7: returns only own pending/active sessions, populated', async () => {
    const host = await createUser({ walletBalance: 1000 });
    const alice = await createUser({ walletBalance: 1000 }); // viewer
    const carol = await createUser({ walletBalance: 1000 }); // unrelated learner

    const listing = await createListing(host);
    await createAcceptedSwap(listing, alice, host);
    const listing2 = await createListing(host);
    await createAcceptedSwap(listing2, carol, host);

    // Alice's live upcoming session (created through the API -> pending).
    const apiRes = await request(app)
      .post('/api/sessions')
      .set('Cookie', authCookie(alice))
      .send({
        peerId: host._id.toString(),
        skillId: listing._id.toString(),
        scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
        durationHours: 1,
      });
    expect(apiRes.status).toBe(201);
    const upcoming = apiRes.body;

    // Alice+host history that must NOT appear: completed and disputed.
    const done = await createSession({ listing, host, learner: alice });
    await Session.findByIdAndUpdate(done._id, { status: 'completed' });
    const fought = await createSession({ listing, host, learner: alice });
    await Session.findByIdAndUpdate(fought._id, { status: 'disputed' });

    // Carol+host pending session — not Alice's business.
    await createSession({ listing: listing2, host, learner: carol });

    const res = await request(app)
      .get('/api/sessions/me')
      .set('Cookie', authCookie(alice));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ids = res.body.map((s) => s._id.toString());
    expect(ids).toHaveLength(1);
    expect(ids).toContain(upcoming._id.toString());
    expect(ids).not.toContain(done._id.toString());
    expect(ids).not.toContain(fought._id.toString());

    const mine = res.body[0];
    expect(mine.hostId.username).toBe(host.username);
    expect(mine.learnerId.username).toBe(alice.username);
    expect(mine.skillId.title).toBe(listing.title);
    expect(mine.skillId.costPerHour).toBeCloseTo(listing.costPerHour, 6);
  });
});
