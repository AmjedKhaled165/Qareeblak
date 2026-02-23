const { Pool } = require('pg');

const dbConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'qareeblak',
    password: 'qareeblak123',
    port: 5432,
};
const pool = new Pool(dbConfig);

const API_URL = 'http://localhost:5000'; // Port 5000
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'halan-secret-key-2026';

async function runTest() {
    const client = await pool.connect();
    try {
        console.log('--- STARTING COURIER VIEW TEST ---');

        // 1. Create a Test User (Partner/Courier Owner)
        const testUserEmail = `courier_owner_${Date.now()}@example.com`;
        const userRes = await client.query(`
            INSERT INTO users (name, email, password, role, phone, user_type)
            VALUES ('Courier Tester', $1, 'hashedpass', 'owner', '01222222222', 'partner_owner')
            RETURNING id
        `, [testUserEmail]);
        const userId = userRes.rows[0].id;
        const token = jwt.sign({ userId, role: 'owner', user_type: 'partner_owner' }, JWT_SECRET);

        // 2. Create Two Providers
        const provEmail1 = `provA_${Date.now()}@example.com`;
        const provEmail2 = `provB_${Date.now()}@example.com`;
        const category = 'TestCat';
        const prov1Res = await client.query("INSERT INTO providers (name, user_id, email, category) VALUES ('Prov A', $1, $2, $3) RETURNING id", [userId, provEmail1, category]);
        const prov2Res = await client.query("INSERT INTO providers (name, user_id, email, category) VALUES ('Prov B', $1, $2, $3) RETURNING id", [userId, provEmail2, category]);
        const prov1Id = prov1Res.rows[0].id;
        const prov2Id = prov2Res.rows[0].id;

        // 3. Create a SPLIT Order via API
        console.log('Creating split order...');
        const res = await fetch(`${API_URL}/api/halan/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customerName: 'Split Customer',
                customerPhone: '01055555555',
                deliveryAddress: 'Test Address',
                items: [
                    { name: 'Pizza', quantity: 1, price: 100, providerId: prov1Id, providerName: 'Prov A' },
                    { name: 'Pepsi', quantity: 2, price: 20, providerId: prov2Id, providerName: 'Prov B' }
                ],
                source: 'manual',
                deliveryFee: 15
            })
        });
        const createData = await res.json();

        if (!createData.success) {
            throw new Error(`Create failed: ${JSON.stringify(createData)}`);
        }

        // In split mode, the API returns the PARENT ID as data.id (or parentId).
        // If it returns the delivery order ID, we use that.
        // Let's check the structure.
        console.log('Create Response:', JSON.stringify(createData, null, 2));

        // Depending on implementation, we might get parentId or data object.
        // If split, we expect a parent order and multiple bookings.
        // BUT the main "delivery_orders" record is what the courier sees.
        // Let's assume createData.data is the delivery order or we need to find it.

        let deliveryOrderId = createData.data?.id;
        // If createData.parentId exists, it means we have a parent order.
        // The delivery order (for the courier) is usually created too?
        // Wait, halan-orders.js create logic:
        // If splitMode:
        //   -> Create Parent Order
        //   -> Create Delivery Order (linked to parent)
        //   -> Create Bookings (linked to parent AND delivery order)
        // So createData.data should be the Delivery Order.

        console.log(`Target Delivery Order ID: ${deliveryOrderId}`);

        // 4. Fetch Order as Courier (Simulated by using same token but checking response structure)
        console.log('Fetching order details...');
        const getRes = await fetch(`${API_URL}/api/halan/orders/${deliveryOrderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const getData = await getRes.json();

        if (!getData.success) {
            throw new Error(`Get failed: ${JSON.stringify(getData)}`);
        }

        const order = getData.data;
        console.log('Fetched Order Sub-orders:', JSON.stringify(order.sub_orders, null, 2));

        // 5. Verify Sub-orders
        if (!order.sub_orders || order.sub_orders.length !== 2) {
            throw new Error(`Expected 2 sub-orders, got ${order.sub_orders?.length}`);
        }

        const statuses = order.sub_orders.map(s => s.status);
        console.log('Sub-order Statuses:', statuses);

        if (statuses.every(s => s === 'pending')) {
            console.log('✅ SUCCESS: Sub-orders present and pending.');
        } else {
            console.warn('⚠️ Warning: Statuses ensure matches expectation (pending).');
        }

        // Cleanup
        await client.query('DELETE FROM bookings WHERE halan_order_id = $1', [deliveryOrderId]);
        await client.query('DELETE FROM delivery_orders WHERE id = $1', [deliveryOrderId]);
        // Also clean up parent if possible, but we need ID.
        if (createData.parentId) {
            await client.query('DELETE FROM parent_orders WHERE id = $1', [createData.parentId]);
        }
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
