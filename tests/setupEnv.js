// Loaded via jest.config.js setupFiles — runs BEFORE any app code is required,
// so process.env is ready when middleware/index.js read the secrets.
//
// The repo ships only `.env.example` (no real .env), and tests must be hermetic,
// so we set deterministic dev-only dummy values here instead of relying on dotenv.
process.env.NODE_ENV = 'test';
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'test-only-jwt-access-secret';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-only-jwt-refresh-secret';
}
