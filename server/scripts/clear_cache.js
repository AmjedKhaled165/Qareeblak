require('dotenv').config();
const { client } = require('../utils/redis');

async function run() {
  try {
    console.log("Connecting to Redis...");
    await client.connect();
    
    console.log("Flushing Redis DB...");
    await client.flushdb();
    
    console.log("Redis cache cleared successfully!");
  } catch (err) {
    console.error("Error clearing Redis:", err);
  } finally {
    client.disconnect();
    process.exit(0);
  }
}

run();
