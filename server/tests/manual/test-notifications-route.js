const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications/user/1',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('BODY:', data.substring(0, 500));
        if (res.statusCode === 200) {
            console.log('✅ Notification API reachable');
        } else if (res.statusCode === 404 && data.includes('Cannot GET')) {
            console.log('❌ Notification API route NOT found (Express 404)');
        } else {
            console.log('⚠️ Unexpected status');
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
