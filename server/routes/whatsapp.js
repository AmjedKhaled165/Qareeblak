// WhatsApp Integration via Evolution API
// Handles webhook events and sends order invoices

const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ============ CONFIGURATION ============
// Update these values with your Evolution API settings
// Update these values via your .env file
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'whatsappbot';
const EVOLUTION_WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

// CRIT-03: SSRF Prevention — Validate Evolution API URL at startup
if (EVOLUTION_API_URL) {
    try {
        const parsed = new URL(EVOLUTION_API_URL);
        const BLOCKED_HOSTS = ['169.254.169.254', '::1', 'localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '192.168.'];
        const isBlocked = BLOCKED_HOSTS.some(b => parsed.hostname === b || parsed.hostname.startsWith(b));
        if (isBlocked && process.env.NODE_ENV === 'production') {
            logger.error(`FATAL: EVOLUTION_API_URL points to blocked internal host: ${parsed.hostname}`);
            process.exit(1);
        }
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
            logger.error('FATAL: EVOLUTION_API_URL must use HTTPS in production');
            process.exit(1);
        }
    } catch (e) {
        logger.error(`FATAL: Invalid EVOLUTION_API_URL: ${e.message}`);
        process.exit(1);
    }
}

if (!EVOLUTION_API_KEY && process.env.NODE_ENV === 'production') {
    logger.error('âš ï¸ CRITICAL: EVOLUTION_API_KEY is missing in production!');
}

const { verifyToken, isAdmin } = require('../middleware/auth');

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
        return `- ${item.name || item.product_name || 'Ù…Ù†ØªØ¬'} (x${qty}): ${total} Ø¬.Ù…`;
    }).join('\n');

    const itemsTotal = items.reduce((sum, item) => {
        return sum + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1));
    }, 0);

    const deliveryFee = Number(order.delivery_fee || 0);
    const grandTotal = itemsTotal + deliveryFee;

    const message = `ðŸ§¾ *ÙØ§ØªÙˆØ±Ø© Ø·Ù„Ø¨ - Ø§Ø·Ù„Ø¨ Ø­Ø§Ù„Ø§*
------------------------------
ðŸ‘¤ *Ø§Ù„Ø¹Ù…ÙŠÙ„:* ${order.customer_name}
ðŸ“± *Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ:* ${order.customer_phone}
ðŸ“ *Ø§Ù„Ø¹Ù†ÙˆØ§Ù†:* ${order.delivery_address}
------------------------------
ðŸ›’ *Ø§Ù„Ø£ØµÙ†Ø§Ù:*
${itemsList}

ðŸšš *Ø®Ø¯Ù…Ø© Ø§Ù„ØªÙˆØµÙŠÙ„:* ${deliveryFee.toFixed(2)} EGP
------------------------------
ðŸ’° *Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ:* ${grandTotal.toFixed(2)} EGP
------------------------------
ðŸï¸ *Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨:* ${courier?.name || 'ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}
ðŸ“± *Ø±Ù‚Ù… Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨:* ${courier?.phone || 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
â° *ÙˆÙ‚Øª Ø§Ù„ØªÙˆØµÙŠÙ„:* ${formatArabicDate(new Date())}
------------------------------
        Ø´ÙƒØ±Ø§Ù‹ Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…ÙƒÙ… ØªØ·Ø¨ÙŠÙ‚ Ø§Ø·Ù„Ø¨ Ø­Ø§Ù„Ø§! ðŸŒ¹`;

    return message;
}

/**
 * Send WhatsApp message via Evolution API
 */
async function sendWhatsAppMessage(phone, message) {
    const formattedPhone = formatWhatsAppNumber(phone);
    if (!formattedPhone) {
        logger.error('Invalid phone number:', phone);
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        const targetUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
        logger.info('ðŸ”— Attempting to connect to WhatsApp API at:', targetUrl);
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
            logger.info('âœ… WhatsApp message sent successfully to:', formattedPhone);
            return { success: true, data };
        } else {
            logger.error('âŒ Failed to send WhatsApp message:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        logger.error('âŒ WhatsApp API error:', error.message);
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
            logger.error('Order not found:', orderId);
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
            logger.info(`ðŸ“§ Invoice sent for order #${orderId} to ${order.customer_phone}`);
        }

        return result;
    } catch (error) {
        logger.error('Error sending invoice:', error);
        return { success: false, error: error.message };
    }
}

// ============ WEBHOOK ENDPOINT ============
// This is the URL you'll put in Evolution API webhook settings

// CRIT-01: Webhook HMAC Signature Verification
// Evolution API must be configured to sign webhooks with EVOLUTION_WEBHOOK_SECRET
function verifyEvolutionWebhook(req) {
    if (!EVOLUTION_WEBHOOK_SECRET) {
        // In dev mode without secret, allow through but warn
        if (process.env.NODE_ENV === 'production') {
            logger.error('FATAL: EVOLUTION_WEBHOOK_SECRET not set in production. Rejecting all webhooks.');
            return false;
        }
        logger.warn('[Webhook] No EVOLUTION_WEBHOOK_SECRET set — skipping signature check (dev only)');
        return true;
    }
    const signature = req.headers['x-evolution-hmac-sha256'] || req.headers['x-hub-signature-256'];
    if (!signature) return false;
    const rawBody = JSON.stringify(req.body);
    const computed = 'sha256=' + crypto.createHmac('sha256', EVOLUTION_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
    } catch {
        return false;
    }
}

router.post('/webhook', async (req, res) => {
    // CRIT-01: Always validate webhook origin before processing
    if (!verifyEvolutionWebhook(req)) {
        logger.warn(`[Webhook] Rejected forged webhook from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    try {
        const event = req.body;

        logger.info('ðŸ“¥ Received Evolution API webhook:', event.event);

        // Handle different event types
        switch (event.event) {
            case 'messages.upsert':
                // Handle incoming messages if needed
                logger.info('New message received:', event.data?.message?.conversation);
                break;

            case 'connection.update':
                logger.info('Connection status:', event.data?.state);
                break;

            default:
                logger.info('Unhandled event:', event.event);
        }

        res.json({ success: true, received: true });
    } catch (error) {
        logger.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MANUAL TEST ENDPOINT ============
// Test sending an invoice manually (Admin Only)

router.post('/send-invoice/:orderId', verifyToken, isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await sendOrderInvoice(orderId);
        res.json(result);
    } catch (error) {
        logger.error('Send invoice error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CHECK CONNECTION STATUS ============

router.get('/status', verifyToken, isAdmin, async (req, res) => {
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
