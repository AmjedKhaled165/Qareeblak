require('dotenv').config({ path: './server/.env.production' });
const db = require('./server/db');
const deliveryService = require('./server/services/delivery.service');

async function run() {
    try {
        const userId = 1; // Replace with a valid admin or partner user ID
        const role = 'owner';
        
        const data = {
            customerName: 'امجد',
            customerPhone: '015586139854',
            pickupAddress: 'المحل / المخزن',
            deliveryAddress: 'شمال الجامعة',
            courierId: 10, // Assuming 10 is valid
            notes: '',
            deliveryFee: 30,
            items: [
                { name: 'كشري الشيخ', price: 30, quantity: 2, providerId: 21, providerName: 'طارق حسن' },
                { name: 'كريم شعر', price: 50, quantity: 3, providerId: 22, providerName: 'د. خالد عبدالرحمن' },
                { name: 'فوط صحية', price: 90, quantity: 8 }
            ]
        };

        const result = await deliveryService.createOrder(userId, role, data, null);
        console.log("Success:", result);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit();
    }
}

run();
