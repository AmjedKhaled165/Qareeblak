const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeLocal() {
  const passwords = ['postgres', 'root', '123456', '1234', 'admin', 'password', 'Qareeblak'];
  const user = 'postgres';
  const database = 'qareeblak'; // Based on the screenshot
  
  let connectedClient = null;

  for (let pwd of passwords) {
    console.log(`Trying password: "${pwd}"...`);
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: user,
      password: pwd,
      database: database
    });
    
    try {
      await client.connect();
      console.log(`✅ SUCCESS! Connected to local PostgreSQL with password: "${pwd}"`);
      connectedClient = client;
      break;
    } catch (e) {
      // ignore and try next
    }
  }

  if (!connectedClient) {
    console.log("❌ Could not connect with common passwords. Do you have a specific password for your local Postgres?");
    return;
  }

  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    const updatePath = path.join(__dirname, '../update_db.sql');

    console.log('📖 Reading SQL files...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const updateSql = fs.readFileSync(updatePath, 'utf8');
    
    console.log('⚙️ Executing schema.sql (Resetting tables)...');
    await connectedClient.query(schemaSql);
    
    console.log('⚙️ Executing update_db.sql (Inserting users and updating schema)...');
    await connectedClient.query(updateSql);
    
    console.log('🚀 All operations completed successfully! Database is fully set up locally.');
  } catch (err) {
    console.error('❌ Error executing queries:', err);
  } finally {
    await connectedClient.end();
  }
}

executeLocal();
