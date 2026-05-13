// Removed node-fetch dependency


// If node-fetch is not installed (it usually isn't in older nodes or by default), we can use http module
// But let's try assuming standard fetch might be available in newer node or use http.
const http = require('http');

const data = JSON.stringify({
    supervisorId: 2
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/halan/users/1/supervisor',
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Bearer test-token' // This will fail auth but should return JSON 401, not HTML
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        console.log('BODY:');
        console.log(body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
