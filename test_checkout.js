const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env.production') });
const bookingService = require('./server/services/booking.service');
const pool = require('./server/db');

async function testCheckout() {
  try {
    // We will test the checkout service function exactly as the API would call it.
    // Pick an existing user and some items.
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;

    // Pick an existing service to checkout
    const serviceRes = await pool.query('SELECT id, provider_id, price FROM services LIMIT 1');
    const service = serviceRes.rows[0];

    const items = [
      {
        id: service.id.toString(),
        providerId: service.provider_id.toString(),
        providerName: 'Test Provider',
        quantity: 1,
        price: Number(service.price)
      }
    ];

    const addressInfo = {
      address: 'Test Address',
      area: 'Test Area',
      street: 'Test Street',
      details: 'Test Details',
      phone: '01012345678',
      name: 'Test Name'
    };

    console.log('Testing checkout for user:', userId);
    const result = await bookingService.checkoutTransaction(userId, items, addressInfo, {
      userPrizeId: null,
      promoCode: null,
      useWallet: false,
      idempotencyKey: 'test_key_123',
      io: { to: () => ({ emit: () => {} }) } // mock io
    });

    console.log('✅ Checkout Success:', result);
    process.exit(0);
  } catch(e) {
    console.error('❌ Checkout Failed:', e.stack);
    process.exit(1);
  }
}

testCheckout();
