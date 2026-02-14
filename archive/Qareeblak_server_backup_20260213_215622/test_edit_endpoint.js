const http = require('http');

// Helper to make a request
function makeRequest() {
    console.log('Testing PUT /api/halan/orders/1...');

    const data = JSON.stringify({
        customerName: "Test Update",
        customerPhone: "01000000000",
        deliveryAddress: "Test Address",
        deliveryFee: 10,
        items: [{ name: "Test Item", quantity: 1 }],
        notes: "Test Note",
        courierId: null
    });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/halan/orders/1',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            // We might get 401 Unauthorized, but that's better than 404. 
            // It proves the route exists.
        }
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('BODY:', body);
            if (res.statusCode === 404) {
                console.error("FAIL: Route not found (404). Server definitely needs restart.");
            } else if (res.statusCode === 401 || res.statusCode === 403) {
                console.log("SUCCESS-ISH: Route exists (Got 401/403). Backend code IS updated.");
            } else if (res.statusCode === 200) {
                console.log("SUCCESS: Order updated.");
            } else {
                console.log("UNKNOWN: status", res.statusCode);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
}

makeRequest();
