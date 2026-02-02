// No import needed for Node.js 18+
async function test() {
    try {
        console.log('Testing GET http://localhost:5000/api/halan/orders/2 ...');
        const response = await fetch('http://localhost:5000/api/halan/orders/2', {
            headers: {
                // Mock auth header if needed, or rely on handling 401 correctly
                'Authorization': `Bearer ${process.env.TEST_TOKEN || ''}`
            }
        });
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));

        const text = await response.text();
        console.log('Body Preview:', text.substring(0, 500));

        if (response.status === 404 && text.includes('Cannot GET')) {
            console.error('\n❌ RESULT: Route still not found. The server probably needs a RESTART to load the new code.');
        } else if (response.status === 200) {
            console.log('\n✅ RESULT: Success!');
        } else {
            console.log('\n⚠️ RESULT: Recieved response, but not 200 OK.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
