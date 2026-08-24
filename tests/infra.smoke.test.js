const request = require('supertest');
const { app, server } = require('../index');
const User = require('../models/User');
const { connectDb, cleanDb, disconnectDb } = require('./helpers/db');
const { createUser } = require('./helpers/factories');

let connected = false;

beforeAll(async () => {
  await connectDb();
  connected = true;
});

afterAll(async () => {
  if (connected) await disconnectDb();
});

describe('test infrastructure smoke', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test('requiring index.js gives an express app without opening a port', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function'); // express apps are request handler functions
    // No port should have been opened by the require — prove nothing is listening.
    expect(serverListening()).toBe(false);
  });

  test('protected route without cookie returns 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('real DB roundtrip: factory user saves and is found', async () => {
    const created = await createUser({ walletBalance: 42.5 });
    const found = await User.findOne({ _id: created._id });
    expect(found).not.toBeNull();
    expect(found.username).toBe(created.username);
    expect(found.walletBalance).toBeCloseTo(42.5);
    expect(found.passwordHash).not.toBe('Password123!'); // stored hashed
  });
});

function serverListening() {
  return server.listening;
}
