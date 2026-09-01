const http = require('http');
const pool = require('./db');

const request = (path, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

async function checkFixes() {
    console.log("--- Checking Track Endpoint (Provider ID) ---");
    const trackRes = await request('/api/halan/orders/track/5');
    if (trackRes.statusCode === 200) {
        const o = trackRes.body.order;
        console.log(`Order ID: ${o.id}`);
        console.log(`Provider ID: ${o.provider_id} (Type: ${typeof o.provider_id})`);
        console.log(`Items: ${JSON.stringify(o.items)}`);
    } else {
        console.log("Track Failed:", trackRes.body);
    }

    console.log("\n--- Checking Cancel Endpoint (Should not be 404) ---");
    const cancelRes = await request('/api/halan/orders/5/customer-cancel', 'POST', {});
    console.log(`Status: ${cancelRes.statusCode}`);
    console.log(`Body:`, cancelRes.body);

    if (cancelRes.statusCode === 404) console.log("❌ FAIL: Still 404 (Not Found)");
    else if (cancelRes.statusCode === 400) console.log("✅ SUCCESS: Found order (Time limit error expected)");
    else if (cancelRes.statusCode === 200) console.log("✅ SUCCESS: Cancelled");

}

checkFixes();
