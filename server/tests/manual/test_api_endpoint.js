// const fetch = require('node-fetch'); // Native fetch in Node 18+
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'qareeblak_secret_key_change_in_production'; // Hardcoded from server/.env

async function testApi() {
    // 1. Create a valid token for User 19 (Partner Supervisor)
    const token = jwt.sign(
        { id: 19, role: 'partner_supervisor', user_type: 'partner_supervisor' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    console.log('Testing API with Token for User 19...');

    try {
        const url2 = 'http://localhost:5000/api/halan/users';

        console.log(`Fetching ${url2} ...`);
        const response = await fetch(url2, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Status: ${response.status}`);
        const data = await response.json();

        if (data.success) {
            const couriers = data.data.filter(u => u.role === 'courier');
            console.log(`Found ${couriers.length} couriers.`);

            // Inspect the first few couriers' supervisorIds
            couriers.slice(0, 5).forEach(c => {
                console.log(`Courier ${c.name} (${c.id}) SupervisorIds:`, c.supervisorIds, 'Type:', typeof c.id, 'SupId Type:', c.supervisorIds.length > 0 ? typeof c.supervisorIds[0] : 'N/A');
            });

            // Check specific couriers 26, 27, 28
            const targetCouriers = couriers.filter(c => [26, 27, 28].includes(c.id));
            targetCouriers.forEach(c => {
                console.log(`Target Courier ${c.name} (${c.id}):`, c.supervisorIds);
            });
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testApi();
