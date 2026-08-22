// tests/sanity.test.js — minimal smoke test to verify Jest harness
describe('Skillswap Backend Sanity', () => {
  it('loads express app without crashing', () => {
    const express = require('express');
    const app = express();
    expect(app).toBeDefined();
  });

  it('has required env var names documented', () => {
    const fs = require('fs');
    const envExample = fs.readFileSync(__dirname + '/../.env.example', 'utf8');
    expect(envExample).toContain('MONGO_URI');
    expect(envExample).toContain('JWT_ACCESS_SECRET');
    expect(envExample).toContain('JWT_REFRESH_SECRET');
  });
});
