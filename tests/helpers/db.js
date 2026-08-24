const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Same stash file written by globalSetup.js
const URI_FILE = path.join(__dirname, '..', '.mongo-uri.json');

let connected = false;

async function connectDb() {
  if (connected) return mongoose;
  const { uri } = JSON.parse(fs.readFileSync(URI_FILE, 'utf8'));
  await mongoose.connect(uri);
  connected = true;
  return mongoose;
}

// Drop the whole test database between tests — hermetic, no leftover state.
async function cleanDb() {
  await mongoose.connection.dropDatabase();
}

async function disconnectDb() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connectDb, cleanDb, disconnectDb };
