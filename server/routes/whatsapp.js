// WhatsApp Integration via Evolution API
// Handles webhook events and sends order invoices

const express = require('express');
const router = express.Router();
const pool = require('../db');

// ============ CONFIGURATION ============
// Update these values with your Evolution API settings
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://4.251.193.65:8081';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '00CC1696EC08-42A0-ADDF-68626D1C6955';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'whatsappbot';

// ============ HELPER FUNCTIONS ============

/**
 * Format phone number for WhatsApp (Egypt format)
 * Converts 01xxxxxxxxx to 201xxxxxxxxx@s.whatsapp.net
 */
function formatWhatsAppNumber(phone) {
    if (!phone) return null;

    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Add Egypt country code if missing
    if (cleaned.startsWith('0')) {
        cleaned = '2' + cleaned;
    } else if (!cleaned.startsWith('20')) {
        cleaned = '20' + cleaned;
    }

    return cleaned;
}

/**
 * Format date in Arabic
 */
function formatArabicDate(date) {
    return new Date(date).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
}

/**
 * Generate invoice message for WhatsApp
 */
function generateInvoiceMessage(order, courier, items) {
    const itemsList = items.map(item => {
        const price = Number(item.price || item.unit_price || 0);
        const qty = Number(item.quantity || 1);
        const total = (price * qty).toFixed(2);
        return `- ${item.name || item.product_name || 'منتج'} (x${qty}): ${total} ج.م`;
    }).join('\n');

    const itemsTotal = items.reduce((sum, item) => {
        return sum + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1));
    }, 0);

    const deliveryFee = Number(order.delivery_fee || 0);
    const grandTotal = itemsTotal + deliveryFee;

    const message = `🧾 *فاتورة طلب - اطلب حالا*
------------------------------
👤 *العميل:* ${order.customer_name}
📱 *رقم الهاتف:* ${order.customer_phone}
📍 *العنوان:* ${order.delivery_address}
------------------------------
🛒 *الأصناف:*
${itemsList}

🚚 *خدمة التوصيل:* ${deliveryFee.toFixed(2)} EGP
------------------------------
💰 *الإجمالي:* ${grandTotal.toFixed(2)} EGP
------------------------------
🏍️ *المندوب:* ${courier?.name || 'غير معروف'}
📱 *رقم المندوب:* ${courier?.phone || 'غير متوفر'}
⏰ *وقت التوصيل:* ${formatArabicDate(new Date())}
------------------------------
        شكراً لاستخدامكم تطبيق اطلب حالا! 🌹`;

    return message;
}

/**
 * Send WhatsApp message via Evolution API
 */
async function sendWhatsAppMessage(phone, message) {
    const formattedPhone = formatWhatsAppNumber(phone);
    if (!formattedPhone) {
        console.error('Invalid phone number:', phone);
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        const targetUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
        console.log('🔗 Attempting to connect to WhatsApp API at:', targetUrl);
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ WhatsApp message sent successfully to:', formattedPhone);
            return { success: true, data };
        } else {
            console.error('❌ Failed to send WhatsApp message:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ WhatsApp API error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send order invoice to customer via WhatsApp
 */
async function sendOrderInvoice(orderId) {
    try {
        // Get order details with courier info
        const orderResult = await pool.query(`
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            WHERE o.id = $1
        `, [orderId]);

        if (orderResult.rows.length === 0) {
            console.error('Order not found:', orderId);
            return { success: false, error: 'Order not found' };
        }

        const order = orderResult.rows[0];

        // Parse items
        let items = [];
        if (typeof order.items === 'string') {
            try {
                items = JSON.parse(order.items);
            } catch (e) {
                items = [];
            }
        } else if (Array.isArray(order.items)) {
            items = order.items;
        }

        // Generate and send invoice
        const courier = {
            name: order.courier_name,
            phone: order.courier_phone
        };

        const invoiceMessage = generateInvoiceMessage(order, courier, items);

        // Send to customer
        const result = await sendWhatsAppMessage(order.customer_phone, invoiceMessage);

        // Log the invoice sending
        if (result.success) {
            console.log(`📧 Invoice sent for order #${orderId} to ${order.customer_phone}`);
        }

        return result;
    } catch (error) {
        console.error('Error sending invoice:', error);
        return { success: false, error: error.message };
    }
}

// ============ WEBHOOK ENDPOINT ============
// This is the URL you'll put in Evolution API webhook settings

router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;

        console.log('📥 Received Evolution API webhook:', event.event);

        // Handle different event types
        switch (event.event) {
            case 'messages.upsert':
                // Handle incoming messages if needed
                console.log('New message received:', event.data?.message?.conversation);
                break;

            case 'connection.update':
                console.log('Connection status:', event.data?.state);
                break;

            default:
                console.log('Unhandled event:', event.event);
        }

        res.json({ success: true, received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MANUAL TEST ENDPOINT ============
// Test sending an invoice manually

router.post('/send-invoice/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await sendOrderInvoice(orderId);
        res.json(result);
    } catch (error) {
        console.error('Send invoice error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CHECK CONNECTION STATUS ============

router.get('/status', async (req, res) => {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        const data = await response.json();
        res.json({ success: true, status: data });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Export the sendOrderInvoice function for use in other routes
module.exports = router;
module.exports.sendOrderInvoice = sendOrderInvoice;
