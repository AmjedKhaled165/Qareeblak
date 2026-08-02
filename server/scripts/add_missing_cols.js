require('dotenv').config();
const pool = require('../db');

async function fixMissingCols() {
  try {
    console.log("Adding missing columns to users table...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS avatar TEXT,
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cancellation_count INTEGER DEFAULT 0;
    `);
    console.log("Users table updated successfully.");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixMissingCols();
