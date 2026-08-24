const fs = require('fs');
const path = require('path');

const URI_FILE = path.join(__dirname, '.mongo-uri.json');

module.exports = async function globalTeardown() {
  const mongod = global.__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
  try {
    fs.unlinkSync(URI_FILE);
    // Also remove the empty parent dir if we created it
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};
