#!/usr/bin/env node

/**
 * Test WhatsApp Connection with Evolution API
 * Run: node test-whatsapp-connection.js
 */

const http = require('http');
const https = require('https');

const config = {
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080',
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || 'B03332C322B9-4DC7-8ACB-52AC13AE6E8A',
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE || 'whatsappbot'
};

console.log('\n📱 WhatsApp Evolution API Connection Test');
console.log('=============================================\n');

console.log('Configuration:');
console.log(`  EVOLUTION_API_URL: ${config.EVOLUTION_API_URL}`);
console.log(`  EVOLUTION_INSTANCE: ${config.EVOLUTION_INSTANCE}`);
console.log(`  EVOLUTION_API_KEY: ${config.EVOLUTION_API_KEY.substring(0, 8)}...`);
console.log('');

async function testConnection() {
  return new Promise((resolve) => {
    const targetUrl = `${config.EVOLUTION_API_URL}/message/sendText/${config.EVOLUTION_INSTANCE}`;
    
    console.log(`🔗 Testing connection to: ${targetUrl}\n`);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.EVOLUTION_API_KEY
      }
    };

    const payload = JSON.stringify({
      number: '201001234567',
      text: 'Test message from Qareeblak'
    });

    const protocol = config.EVOLUTION_API_URL.startsWith('https') ? https : http;
    
    const req = protocol.request(config.EVOLUTION_API_URL + `/message/sendText/${config.EVOLUTION_INSTANCE}`, options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ Got Response - Status: ${res.statusCode}`);
        console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
        
        try {
          const json = JSON.parse(data);
          console.log(`   Body: ${JSON.stringify(json, null, 2)}`);
        } catch {
          console.log(`   Body: ${data}`);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ SUCCESS: Evolution API is running and responding!\n');
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          console.log('\n⚠️  WARNING: API returned client error (may be API auth or format issue)\n');
        } else {
          console.log('\n❌ ERROR: Unexpected response code\n');
        }

        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Network Error: ${err.code || err.message}`);
      
      if (err.code === 'ECONNREFUSED') {
        console.log('\n   → Evolution API is NOT running on this URL');
        console.log(`   → Please start it on ${config.EVOLUTION_API_URL}`);
      } else if (err.code === 'ENOTFOUND') {
        console.log('\n   → Cannot resolve hostname');
        console.log(`   → Check EVOLUTION_API_URL: ${config.EVOLUTION_API_URL}`);
      } else if (err.code === 'ETIMEDOUT') {
        console.log('\n   → Connection timeout - server may be unreachable');
      }

      console.log('\n');
      resolve(false);
    });

    req.write(payload);
    req.end();

    // Timeout after 5 seconds
    setTimeout(() => {
      console.log('❌ Timeout: Request took too long\n');
      resolve(false);
    }, 5000);
  });
}

async function main() {
  const connected = await testConnection();
  
  console.log('📊 Summary:');
  console.log('───────────────────────────────────────');
  
  if (connected) {
    console.log('✅ Evolution API is READY for WhatsApp invoices!');
    console.log('\nNext: Mark an order as delivered to trigger invoice');
  } else {
    console.log('❌ Evolution API is NOT accessible');
    console.log('\nTo fix:');
    console.log('1. Ensure Evolution API is running on http://127.0.0.1:8080');
    console.log('2. Or update EVOLUTION_API_URL in server/.env');
    console.log('3. Restart the backend server: cd server && npm start');
  }
  
  console.log('');
}

main().catch(console.error);
