const { Pool } = require('pg');

const dbConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'qareeblak',
    password: 'qareeblak123',
    port: 5432,
};
const pool = new Pool(dbConfig);

const API_URL = 'http://localhost:5000'; // Adjusted port based on server logs // Adjust port if needed

// Mock Partner Token (you might need a real one or valid fake)
// For this test, we assume we can generate a valid token or basic auth if locally testing
// But since the API uses `authenticatePartner`, we need a valid JWT.
// Let's rely on the DB directly for setup and just call the API.

// We need a helper to login or sign a token.
// Or we can just insert a test user and generate a token.
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'halan-secret-key-2026'; // From source code

async function runTest() {
    const client = await pool.connect();
    try {
        console.log('--- STARTING EDIT SPLIT TEST ---');

        // 1. Create a Test User (Partner)
        const testUserEmail = `test_partner_${Date.now()}@example.com`;
        const userRes = await client.query(`
            INSERT INTO users (name, email, password, role, phone, user_type)
            VALUES ('Test Partner', $1, 'hashedpass', 'owner', '01000000000', 'partner_owner')
            RETURNING id
        `, [testUserEmail]);
        const userId = userRes.rows[0].id;
        const token = jwt.sign({ userId, role: 'owner', user_type: 'partner_owner' }, JWT_SECRET);

        // 2. Create Two Providers
        const provEmail1 = `prov1_${Date.now()}@example.com`;
        const provEmail2 = `prov2_${Date.now()}@example.com`;
        const category = 'Groceries';
        const prov1Res = await client.query("INSERT INTO providers (name, user_id, email, category) VALUES ('Prov A', $1, $2, $3) RETURNING id", [userId, provEmail1, category]);
        const prov2Res = await client.query("INSERT INTO providers (name, user_id, email, category) VALUES ('Prov B', $1, $2, $3) RETURNING id", [userId, provEmail2, category]);
        const prov1Id = prov1Res.rows[0].id;
        const prov2Id = prov2Res.rows[0].id; // New provider for the edit

        // 3. Create a Parent Order via API (or DB)
        // We'll use API to ensure normal flow
        console.log('Creating initial order...');
        let res = await fetch(`${API_URL}/api/halan/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customerName: 'Test Cust',
                customerPhone: '01010101010',
                deliveryAddress: '123 St',
                items: [
                    { name: 'Item A', quantity: 1, price: 100, providerId: prov1Id, providerName: 'Prov A' }
                ],
                source: 'manual',
                deliveryFee: 10
            })
        });
        const createData = await res.json();

        if (!createData.success) {
            throw new Error(`Create failed: ${JSON.stringify(createData)}`);
        }

        const orderId = createData.data.id;
        const parentId = createData.parentId;
        if (!parentId) throw new Error('Parent ID not returned! Split mode failed?');
        console.log(`Order created: ID ${orderId}, Parent ${parentId}`);

        // Verify initial total
        const initialParent = await client.query('SELECT total_price FROM parent_orders WHERE id = $1', [parentId]);
        console.log('Initial Parent Total:', initialParent.rows[0].total_price); // Should be 100

        // 4. Perform Edit: Add Item for Provider B
        console.log('Editing order to add Item B...');
        res = await fetch(`${API_URL}/api/halan/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customerName: 'Test Cust',
                customerPhone: '01010101010',
                deliveryAddress: '123 St',
                deliveryFee: 10,
                items: [
                    { name: 'Item A', quantity: 1, price: 100, providerId: prov1Id, providerName: 'Prov A' },
                    { name: 'Item B (NEW)', quantity: 2, price: 50, providerId: prov2Id, providerName: 'Prov B' }
                ],
                notes: 'Added item B'
            })
        });
        const editData = await res.json();
        if (!editData.success) {
            throw new Error(`Edit failed: ${JSON.stringify(editData)}`);
        }

        // 5. Verify Results
        // Check Bookings
        const bookingsRes = await client.query('SELECT provider_id, price FROM bookings WHERE parent_order_id = $1', [parentId]);
        console.log(`Found ${bookingsRes.rowCount} bookings.`);

        const bookingProvB = bookingsRes.rows.find(b => b.provider_id == prov2Id);
        if (bookingProvB) {
            console.log('✅ SUCCESS: Booking for Provider B created!');
        } else {
            console.error('❌ FAILURE: No booking found for Provider B');
        }

        // Check Parent Total
        const updatedParent = await client.query('SELECT total_price FROM parent_orders WHERE id = $1', [parentId]);
        const newTotal = parseFloat(updatedParent.rows[0].total_price);
        console.log('Updated Parent Total:', newTotal);

        if (newTotal === 200) { // 100 + (2*50) = 200
            console.log('✅ SUCCESS: Parent Total Updated Correctly!');
        } else {
            console.error(`❌ FAILURE: Expected 200, got ${newTotal}`);
        }

        // Cleanup
        await client.query('DELETE FROM bookings WHERE parent_order_id = $1', [parentId]);
        await client.query('DELETE FROM delivery_orders WHERE id = $1', [orderId]);
        await client.query('DELETE FROM parent_orders WHERE id = $1', [parentId]);
        await client.query('DELETE FROM providers WHERE id IN ($1, $2)', [prov1Id, prov2Id]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

    } catch (e) {
        console.error('TEST FAILED:', e);
    } finally {
        client.release();
        pool.end();
    }
}

runTest();
