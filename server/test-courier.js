require('dotenv').config();
const db = require('./db');
const { getOrderByIdSecure } = require('./repositories/delivery.repository');

async function test() {
    try {
        const user = await db.query("INSERT INTO users (name, user_type) VALUES ('Test Courier', 'partner_courier') RETURNING id");
        const cId = user.rows[0].id;
        
        const sup = await db.query("INSERT INTO users (name, user_type) VALUES ('Test Sup', 'partner_supervisor') RETURNING id");
        const sId = sup.rows[0].id;
        
        await db.query('INSERT INTO courier_supervisors (courier_id, supervisor_id) VALUES ($1, $2)', [cId, sId]);

        const order = await db.query('INSERT INTO delivery_orders (status, courier_id, supervisor_id) VALUES ($1, $2, $3) RETURNING id', ['pending', cId, sId]);
        const oId = order.rows[0].id;
        
        const res = await getOrderByIdSecure(oId, {userId: sId, role: 'partner_supervisor'});
        console.log('Fetched Order courier_name:', res.courier_name);
    } catch(e) {
        console.error(e);
    } finally {
        db.end();
    }
}

test();
