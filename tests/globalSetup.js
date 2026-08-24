const fs = require('fs');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Shared stash-file path — also imported by tests/helpers/db.js
const URI_FILE = path.join(__dirname, '.mongo-uri.json');

module.exports = async function globalSetup() {
  // Single-node REPLICA SET via MongoMemoryReplSet: the escrow payout path
  // uses Mongo transactions, which require a replica set (they fail on a
  // standalone mongod with IllegalOperation code 20). NOTE: passing a
  // `replicaSet` key to MongoMemoryServer.create is silently IGNORED in
  // mongodb-memory-server v11 — it must be MongoMemoryReplSet.
  const mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
  });
  const uri = mongod.getUri('skillswap-test');

  // Stash the URI for the jest workers. Note: the MongoMemoryServer instance
  // itself must be kept alive by this process — jest keeps the globalSetup
  // module loaded until globalTeardown runs.
  fs.writeFileSync(URI_FILE, JSON.stringify({ uri }));

  // Expose on globalThis so teardown can stop it even if it was reassigned.
  global.__MONGOD__ = mongod;
};
