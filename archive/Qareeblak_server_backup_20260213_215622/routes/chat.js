// Chat Routes for Pharmacy Consultations
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// ==================== AUTO-MIGRATE ON LOAD ====================
const ensureTablesExist = async () => {
    try {
        console.log('🔄 [Chat] Checking/creating chat tables...');

        // Chat Messages Table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    consultation_id VARCHAR(100) NOT NULL,
                    sender_id INTEGER,
                    sender_type VARCHAR(20) NOT NULL,
                    message TEXT,
                    image_url TEXT,
                    is_read BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (e) { console.error('[Chat] Error creating chat_messages:', e.message); }

        // Add message_type column for order quotes
        try {
            await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text'`);
        } catch (e) { console.warn('[Chat] message_type column:', e.message); }

        // Index on chat_messages
        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation 
                ON chat_messages(consultation_id);
            `);
        } catch (e) { console.warn('[Chat] Index creation warning (chat_messages):', e.message); }

        // Consultations Table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS consultations (
                    id VARCHAR(100) PRIMARY KEY,
                    customer_id INTEGER,
                    provider_id INTEGER,
                    status VARCHAR(20) DEFAULT 'active',
                    order_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (e) { console.error('[Chat] Error creating consultations:', e.message); }

        // Indexes on consultations
        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_consultations_provider 
                ON consultations(provider_id);
            `);
        } catch (e) { console.warn('[Chat] Index creation warning (consultations provider):', e.message); }

        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_consultations_customer 
                ON consultations(customer_id);
            `);
        } catch (e) { console.warn('[Chat] Index creation warning (consultations customer):', e.message); }

        console.log('✅ [Chat] Tables check completed');
    } catch (error) {
        console.error('❌ [Chat] Critical table setup error:', error.message);
    }
};

// Run migration on module load
ensureTablesExist();

// Middleware to authenticate users
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log('[Chat Auth] Headers:', authHeader ? 'Bearer token present' : 'No auth header');

        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        console.log('[Chat Auth] User authenticated:', decoded.userId || decoded.id);
        next();
    } catch (error) {
        console.error('[Chat Auth] Error:', error.message);
        return res.status(401).json({ success: false, error: 'جلسة غير صالحة' });
    }
};

// Generate consultation ID
const generateConsultationId = (providerId, customerId) => {
    return `${providerId}-${customerId}-${Date.now()}`;
};

// ==================== DATABASE SETUP (Call once to create tables) ====================
router.get('/setup-database', async (req, res) => {
    try {
        console.log('🔄 Setting up chat tables...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                consultation_id VARCHAR(100) NOT NULL,
                sender_id INTEGER,
                sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'pharmacist')),
                message TEXT,
                image_url TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation 
            ON chat_messages(consultation_id);
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id VARCHAR(100) PRIMARY KEY,
                customer_id INTEGER,
                provider_id INTEGER,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'converted_to_order')),
                order_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_provider 
            ON consultations(provider_id);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_customer 
            ON consultations(customer_id);
        `);

        console.log('✅ Chat tables created successfully');
        res.json({ success: true, message: 'Database tables created successfully' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== START CONSULTATION ====================
router.post('/start', authenticate, async (req, res) => {
    try {
        const { providerId } = req.body;
        const customerId = req.user.userId || req.user.id;

        console.log('[Chat] Start consultation request:', { providerId, customerId });

        if (!providerId) {
            return res.status(400).json({ success: false, error: 'معرف مقدم الخدمة مطلوب' });
        }

        // Check if there's an existing active consultation
        const existing = await pool.query(`
            SELECT id FROM consultations 
            WHERE customer_id = $1 AND provider_id = $2 AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `, [customerId, providerId]);

        if (existing.rows.length > 0) {
            console.log('[Chat] Using existing consultation:', existing.rows[0].id);
            return res.json({
                success: true,
                consultationId: existing.rows[0].id,
                isExisting: true
            });
        }

        // Create new consultation
        const consultationId = generateConsultationId(providerId, customerId);
        console.log('[Chat] Creating new consultation:', consultationId);

        await pool.query(`
            INSERT INTO consultations (id, customer_id, provider_id, status)
            VALUES ($1, $2, $3, 'active')
        `, [consultationId, customerId, providerId]);

        console.log('[Chat] Consultation created successfully');

        res.json({
            success: true,
            consultationId,
            isExisting: false
        });
    } catch (error) {
        console.error('[Chat] Start consultation error:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في بدء المحادثة',
            details: error.message
        });
    }
});

// ==================== GET MESSAGES ====================
router.get('/:consultationId', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;

        if (!consultationId) {
            return res.status(400).json({ success: false, error: 'معرف المحادثة مطلوب' });
        }

        console.log('[Chat] Fetching messages for consultation:', consultationId);

        const messages = await pool.query(`
            SELECT 
                cm.id,
                cm.consultation_id,
                cm.sender_id,
                cm.sender_type,
                cm.message,
                cm.message_type,
                cm.image_url,
                cm.is_read,
                cm.created_at,
                COALESCE(u.name, 'مستخدم') as sender_name
            FROM chat_messages cm
            LEFT JOIN users u ON cm.sender_id = u.id
            WHERE cm.consultation_id = $1
            ORDER BY cm.created_at ASC
        `, [consultationId]);

        // Get consultation details
        const consultation = await pool.query(`
            SELECT 
                c.*,
                COALESCE(u.name, 'عميل') as customer_name,
                COALESCE(p.name, 'صيدلية') as provider_name
            FROM consultations c
            LEFT JOIN users u ON c.customer_id = u.id
            LEFT JOIN providers p ON c.provider_id = p.id
            WHERE c.id = $1
        `, [consultationId]);

        console.log('[Chat] Fetched', messages.rows.length, 'messages');

        res.json({
            success: true,
            messages: messages.rows || [],
            consultation: consultation.rows[0] || null
        });
    } catch (error) {
        console.error('[Chat] Get messages error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في جلب الرسائل', details: error.message });
    }
});

// ==================== SEND MESSAGE ====================
router.post('/:consultationId/messages', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;
        const { message, imageUrl, senderType, senderId, senderName } = req.body;
        const userId = senderId || req.user.userId || req.user.id;

        console.log('[Chat] Send message request:', { consultationId, userId, senderType, hasMessage: !!message, hasImage: !!imageUrl });

        if (!consultationId) {
            return res.status(400).json({ success: false, error: 'معرف المحادثة مطلوب' });
        }

        if (!message && !imageUrl) {
            return res.status(400).json({ success: false, error: 'الرسالة أو الصورة مطلوبة' });
        }

        // Verify consultation exists
        const consultationCheck = await pool.query(
            'SELECT id FROM consultations WHERE id = $1',
            [consultationId]
        );

        if (consultationCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المحادثة غير موجودة' });
        }

        const result = await pool.query(`
            INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING 
                id,
                consultation_id,
                sender_id,
                sender_type,
                message,
                image_url,
                is_read,
                created_at
        `, [consultationId, userId, senderType || 'customer', message || null, imageUrl || null]);

        // Update consultation updated_at
        await pool.query(
            'UPDATE consultations SET updated_at = NOW() WHERE id = $1',
            [consultationId]
        );

        // Get sender name
        const sender = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const savedMessage = {
            ...result.rows[0],
            sender_name: senderName || sender.rows[0]?.name || 'مستخدم'
        };

        console.log('[Chat] Message sent successfully:', savedMessage.id);

        // Emit via Socket.io if available
        const io = req.app.get('io');
        if (io) {
            io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
            console.log('[Chat] Message broadcast via Socket.io');
        }

        res.json({ success: true, message: savedMessage });
    } catch (error) {
        console.error('[Chat] Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في إرسال الرسالة',
            details: error.message
        });
    }
});

// ==================== MARK AS READ ====================
router.put('/:consultationId/read', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;
        const userId = req.user.userId || req.user.id;

        const result = await pool.query(`
            UPDATE chat_messages 
            SET is_read = true 
            WHERE consultation_id = $1 AND sender_id != $2 AND is_read = false
            RETURNING id
        `, [consultationId, userId]);

        console.log('[Chat] Marked', result.rowCount, 'messages as read for consultation:', consultationId);

        // Emit socket event to notify customer that messages were read
        const io = req.app.get('io');
        if (io && result.rowCount > 0) {
            io.to(`chat-${consultationId}`).emit('messages-read', {
                consultationId,
                readBy: userId,
                messageIds: result.rows.map(r => r.id)
            });
            console.log('[Chat] Broadcast messages-read event');
        }

        res.json({ success: true, markedCount: result.rowCount });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

// ==================== GET PROVIDER STATUS ====================
router.get('/provider/:providerId/status', async (req, res) => {
    try {
        const { providerId } = req.params;

        console.log('[Chat] Checking provider status:', providerId);

        // Check if provider has been active recently (via Socket.io tracking)
        // For now, return a simple status based on last activity
        const provider = await pool.query(`
            SELECT p.id, u.last_location_update
            FROM providers p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = $1
        `, [providerId]);

        if (provider.rows.length === 0) {
            console.log('[Chat] Provider not found:', providerId);
            return res.status(404).json({ success: false, error: 'مقدم الخدمة غير موجود' });
        }

        // Consider online if active within last 5 minutes
        const lastUpdate = provider.rows[0].last_location_update;
        const isOnline = lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 5 * 60 * 1000;

        console.log('[Chat] Provider status:', { providerId, isOnline, lastUpdate });

        res.json({ success: true, isOnline, providerId });
    } catch (error) {
        console.error('[Chat] Get provider status error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ', details: error.message });
    }
});

// ==================== GET PROVIDER CONSULTATIONS ====================
router.get('/provider/:providerId/consultations', authenticate, async (req, res) => {
    try {
        const { providerId } = req.params;
        const { status } = req.query;

        console.log('[Chat] GET /provider/:providerId/consultations -', { providerId, type: typeof providerId, status });

        let query = `
            SELECT 
                c.*,
                u.name as customer_name,
                u.phone as customer_phone,
                (SELECT COUNT(*) FROM chat_messages cm WHERE cm.consultation_id = c.id AND cm.is_read = false AND cm.sender_type = 'customer') as unread_count,
                (SELECT cm.message FROM chat_messages cm WHERE cm.consultation_id = c.id ORDER BY cm.created_at DESC LIMIT 1) as last_message,
                (SELECT cm.created_at FROM chat_messages cm WHERE cm.consultation_id = c.id ORDER BY cm.created_at DESC LIMIT 1) as last_message_time
            FROM consultations c
            LEFT JOIN users u ON c.customer_id = u.id
            WHERE c.provider_id = $1
        `;

        const params = [providerId];

        if (status) {
            query += ` AND c.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY c.updated_at DESC`;

        console.log('[Chat] Executing query:', { query: query.substring(0, 150), params });
        const result = await pool.query(query, params);
        console.log('[Chat] Query result:', { rowCount: result.rows.length, providerId });

        if (result.rows.length > 0) {
            console.log('[Chat] Sample consultations:', result.rows.slice(0, 2).map(r => ({ id: r.id, provider_id: r.provider_id, customer_id: r.customer_id, customer_name: r.customer_name })));
        }

        res.json({ success: true, consultations: result.rows });
    } catch (error) {
        console.error('Get provider consultations error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في جلب المحادثات' });
    }
});

// ==================== UPDATE CONSULTATION STATUS ====================
router.put('/:consultationId/status', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;
        const { status, orderId } = req.body;

        await pool.query(`
            UPDATE consultations 
            SET status = $1, order_id = $2, updated_at = NOW()
            WHERE id = $3
        `, [status, orderId || null, consultationId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update consultation status error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في تحديث الحالة' });
    }
});

// ==================== SEND ORDER QUOTE (Provider → Customer) ====================
router.post('/:consultationId/quote', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;
        const { items } = req.body;
        const userId = req.user.userId || req.user.id;

        console.log('[Chat] Send quote request:', { consultationId, userId, items });

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'يجب إضافة منتج واحد على الأقل' });
        }

        // Validate and sanitize items
        const validItems = items.filter(item => item.name && item.name.trim() && Number(item.price) > 0);
        if (validItems.length === 0) {
            return res.status(400).json({ success: false, error: 'يجب إضافة منتج واحد على الأقل بسعر صحيح' });
        }

        // Calculate total on backend to prevent tampering
        const totalPrice = validItems.reduce((sum, item) => sum + Number(item.price), 0);

        const quoteData = {
            items: validItems.map(item => ({
                name: item.name.trim(),
                price: Number(item.price)
            })),
            totalPrice,
            status: 'pending'
        };

        // Insert as special message type
        const result = await pool.query(`
            INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, message_type)
            VALUES ($1, $2, 'pharmacist', $3, 'order_quote')
            RETURNING id, consultation_id, sender_id, sender_type, message, message_type, image_url, is_read, created_at
        `, [consultationId, userId, JSON.stringify(quoteData)]);

        // Update consultation timestamp
        await pool.query('UPDATE consultations SET updated_at = NOW() WHERE id = $1', [consultationId]);

        const sender = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const savedMessage = {
            ...result.rows[0],
            sender_name: sender.rows[0]?.name || 'الصيدلي'
        };

        console.log('[Chat] Quote sent successfully:', savedMessage.id);

        // Emit via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
            console.log('[Chat] Quote broadcast via Socket.io');
        }

        res.json({ success: true, message: savedMessage });
    } catch (error) {
        console.error('[Chat] Send quote error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في إرسال العرض', details: error.message });
    }
});

// ==================== ACCEPT ORDER QUOTE (Customer → Order) ====================
router.post('/:consultationId/accept-quote', authenticate, async (req, res) => {
    try {
        const { consultationId } = req.params;
        const { messageId, addressArea, addressDetails, phone } = req.body;
        const customerId = req.user.userId || req.user.id;

        console.log('[Chat] Accept quote request:', { consultationId, messageId, customerId });

        // 1. Get the quote message
        const quoteMsg = await pool.query(
            'SELECT * FROM chat_messages WHERE id = $1 AND consultation_id = $2 AND message_type = $3',
            [messageId, consultationId, 'order_quote']
        );

        if (quoteMsg.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'العرض غير موجود' });
        }

        let quoteData;
        try {
            quoteData = JSON.parse(quoteMsg.rows[0].message);
        } catch (e) {
            return res.status(400).json({ success: false, error: 'بيانات العرض غير صالحة' });
        }

        // Check if already accepted
        if (quoteData.status === 'accepted') {
            return res.status(400).json({ success: false, error: 'تم قبول هذا العرض مسبقاً' });
        }

        // 2. Get consultation details
        const consultation = await pool.query('SELECT * FROM consultations WHERE id = $1', [consultationId]);
        if (consultation.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المحادثة غير موجودة' });
        }
        const consult = consultation.rows[0];

        // 3. Get customer info
        const customer = await pool.query('SELECT name, phone, email FROM users WHERE id = $1', [customerId]);
        const customerInfo = customer.rows[0] || {};

        // 4. Get provider info
        const provider = await pool.query('SELECT id, name FROM providers WHERE id = $1', [consult.provider_id]);
        const providerInfo = provider.rows[0] || {};

        // 5. Recalculate total on backend (security)
        const totalPrice = quoteData.items.reduce((sum, item) => sum + Number(item.price), 0);

        // 6. Build items and details
        const orderItems = quoteData.items.map(item => ({
            name: item.name,
            quantity: 1,
            price: item.price
        }));

        const detailParts = [];
        detailParts.push('الطلبات: ' + orderItems.map(i => i.name + ' x' + i.quantity).join(' | '));
        detailParts.push('الإجمالي: ' + totalPrice + ' ج.م');
        if (addressArea) detailParts.push('العنوان: ' + addressArea + (addressDetails ? ' - ' + addressDetails : ''));
        detailParts.push('الهاتف: ' + (phone || customerInfo.phone || 'غير محدد'));

        // 7. Create booking
        const booking = await pool.query(`
            INSERT INTO bookings (user_id, provider_id, service_id, user_name, service_name, provider_name, price, status, details, items)
            VALUES ($1, $2, NULL, $3, $4, $5, $6, 'pending', $7, $8)
            RETURNING *
        `, [
            customerId,
            consult.provider_id,
            customerInfo.name || 'عميل',
            'طلب من المحادثة',
            providerInfo.name || 'صيدلية',
            totalPrice,
            detailParts.join(' | '),
            JSON.stringify(orderItems)
        ]);

        console.log('[Chat] Booking created:', booking.rows[0].id);

        // 8. Update quote message status to 'accepted'
        quoteData.status = 'accepted';
        quoteData.bookingId = booking.rows[0].id;
        await pool.query(
            'UPDATE chat_messages SET message = $1 WHERE id = $2',
            [JSON.stringify(quoteData), messageId]
        );

        // 9. Update consultation status
        await pool.query(
            'UPDATE consultations SET status = $1, order_id = $2, updated_at = NOW() WHERE id = $3',
            ['converted_to_order', booking.rows[0].id, consultationId]
        );

        // 10. Send system message in chat
        const sysMsg = await pool.query(`
            INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, message_type)
            VALUES ($1, $2, 'customer', $3, 'system')
            RETURNING id, consultation_id, sender_id, sender_type, message, message_type, image_url, is_read, created_at
        `, [consultationId, customerId, '✅ تم قبول العرض وإنشاء الطلب رقم #' + booking.rows[0].id]);

        const systemMessage = { ...sysMsg.rows[0], sender_name: 'النظام' };

        // Emit via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.to(`chat-${consultationId}`).emit('new-message', systemMessage);
            io.emit('new-booking', booking.rows[0]);
            console.log('[Chat] Order creation broadcast via Socket.io');
        }

        console.log('[Chat] Quote accepted, booking created:', booking.rows[0].id);

        res.json({
            success: true,
            booking: booking.rows[0],
            message: 'تم إنشاء الطلب بنجاح'
        });
    } catch (error) {
        console.error('[Chat] Accept quote error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في قبول العرض', details: error.message });
    }
});

module.exports = router;
