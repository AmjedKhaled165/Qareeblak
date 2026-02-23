// Test consultation endpoint authentication
const http = require('http');

// Test both token types
const qareeblakToken = 'test'; // Replace with actual token from localStorage
const halanToken = 'test'; // Replace with actual halan token

function testEndpoint(token, tokenType) {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/chat/provider/2/consultations',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`\n=== Testing with ${tokenType} ===`);
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('\nResponse Body:');
            try {
                const json = JSON.parse(data);
                console.log(JSON.stringify(json, null, 2));
            } catch (e) {
                console.log(data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Error with ${tokenType}:`, e.message);
    });

    req.end();
}

console.log('🔍 Testing Consultation Endpoint Authentication');
console.log('================================================');
console.log('\n⚠️  IMPORTANT: Replace the token values in this script with:');
console.log('   1. Open browser console');
console.log('   2. Type: localStorage.getItem("qareeblak_token")');
console.log('   3. Copy the token value');
console.log('   4. Paste it in this script\n');

// Uncomment and add your actual tokens here:
// const realQareeblakToken = 'your_token_here';
// const realHalanToken = 'your_halan_token_here';

// testEndpoint(realQareeblakToken, 'Qareeblak Token');
// testEndpoint(realHalanToken, 'Halan Token');

console.log('\n❌ No tokens provided. Please edit the script with actual tokens.');
