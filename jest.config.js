module.exports = {
  testEnvironment: 'node',
  // Runs before any test module is required — sets JWT secrets etc. so that
  // requiring index.js / middleware never fails on missing env vars.
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  // Boots one in-memory MongoDB (single-node replica set) for the whole run.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // runInBand + forceExit are passed via CLI flags in package.json scripts
  // (socket.io keeps event-loop handles open; --forceExit lets jest exit).
  testMatch: ['**/tests/**/*.test.js'],
};
