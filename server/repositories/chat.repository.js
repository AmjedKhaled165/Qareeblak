const pool = require('../db');

class ChatRepository {
    async getConsultationById(consultationId) {
        const result = await pool.query(
            'SELECT * FROM consultations WHERE id = $1',
            [consultationId]
        );
        return result.rows[0] || null;
    }

    async getActiveConsultation(customerId, providerId) {
        const result = await pool.query(`
            SELECT id FROM consultations 
            WHERE customer_id = $1 AND provider_id = $2 AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `, [customerId, providerId]);
        return result.rows[0] || null;
    }

    async createConsultation(id, customerId, providerId) {
        await pool.query(`
            INSERT INTO consultations (id, customer_id, provider_id, status)
            VALUES ($1, $2, $3, 'active')
        `, [id, customerId, providerId]);
        return id;
    }

    async updateConsultationTimestamp(consultationId) {
        await pool.query(
            'UPDATE consultations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [consultationId]
        );
    }

    async updateConsultationStatus(consultationId, status, orderId = null, client = pool) {
        await client.query(
            'UPDATE consultations SET status = $1, order_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [status, orderId, consultationId]
        );
    }

    async getProviderConsultations(providerId, status, limit, offset) {
        let query = `
            SELECT 
                c.id, c.customer_id, c.provider_id, c.status, c.updated_at,
                u.name as customer_name,
                u.phone as customer_phone,
                COUNT(cm_unread.id) as unread_count,
                cm_last.message as last_message,
                cm_last.created_at as last_message_time
            FROM consultations c
            LEFT JOIN users u ON c.customer_id = u.id
            LEFT JOIN LATERAL (
                SELECT id FROM chat_messages 
                WHERE consultation_id = c.id AND is_read = false AND sender_type = 'customer'
            ) cm_unread ON true
            LEFT JOIN LATERAL (
                SELECT message, created_at FROM chat_messages 
                WHERE consultation_id = c.id 
                ORDER BY created_at DESC LIMIT 1
            ) cm_last ON true
            WHERE c.provider_id = $1 ${status ? 'AND c.status = $2' : ''}
            GROUP BY c.id, u.id, cm_last.message, cm_last.created_at
            ORDER BY c.updated_at DESC
            LIMIT $${status ? 3 : 2} OFFSET $${status ? 4 : 3}
        `;

        const params = status ? [providerId, status, limit, offset] : [providerId, limit, offset];
        const result = await pool.query(query, params);
        return result.rows;
    }

    async getMessages(consultationId, limit, offset) {
        const result = await pool.query(`
            SELECT 
                cm.id, cm.consultation_id, cm.sender_id, cm.sender_type,
                cm.message, cm.message_type, cm.image_url, cm.is_read, cm.created_at,
                COALESCE(u.name, 'مستخدم') as sender_name
            FROM chat_messages cm
            LEFT JOIN users u ON cm.sender_id = u.id
            WHERE cm.consultation_id = $1
            ORDER BY cm.created_at DESC
            LIMIT $2 OFFSET $3
        `, [consultationId, limit, offset]);

        // Reverse to return ascending chronological order for UI
        return result.rows.reverse();
    }

    async saveMessage({ consultationId, senderId, senderType, message, messageType = 'text', imageUrl = null }, client = pool) {
        const result = await client.query(`
            INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, message_type, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, consultation_id, sender_id, sender_type, message, message_type, image_url, is_read, created_at
        `, [consultationId, senderId, senderType, message, messageType, imageUrl]);
        return result.rows[0];
    }

    async updateMessageContent(messageId, newContent, client = pool) {
        await client.query(
            'UPDATE chat_messages SET message = $1 WHERE id = $2',
            [newContent, messageId]
        );
    }

    async getMessageById(messageId, consultationId, messageType) {
        const result = await pool.query(
            'SELECT * FROM chat_messages WHERE id = $1 AND consultation_id = $2 AND message_type = $3',
            [messageId, consultationId, messageType]
        );
        return result.rows[0] || null;
    }

    async markMessagesAsRead(consultationId, userId) {
        const result = await pool.query(`
            UPDATE chat_messages 
            SET is_read = true 
            WHERE consultation_id = $1 AND sender_id != $2 AND is_read = false
            RETURNING id
        `, [consultationId, userId]);
        return result.rows;
    }

    async getUserInfo(userId) {
        const result = await pool.query('SELECT name, phone, email FROM users WHERE id = $1', [userId]);
        return result.rows[0] || null;
    }

    async getProviderInfo(providerId) {
        const result = await pool.query('SELECT id, name FROM providers WHERE id = $1', [providerId]);
        return result.rows[0] || null;
    }

    async createBooking(bookingData, client = pool) {
        const { customerId, providerId, customerName, providerName, totalPrice, details, items } = bookingData;
        const result = await client.query(`
            INSERT INTO bookings (user_id, provider_id, service_id, user_name, service_name, provider_name, price, status, details, items)
            VALUES ($1, $2, NULL, $3, 'طلب من المحادثة', $4, $5, 'pending', $6, $7)
            RETURNING *
        `, [customerId, providerId, customerName, providerName, totalPrice, details, items]);
        return result.rows[0];
    }

    async beginTransaction() {
        const client = await pool.connect();
        await client.query('BEGIN');
        return client;
    }

    async commitTransaction(client) {
        await client.query('COMMIT');
        client.release();
    }

    async rollbackTransaction(client) {
        await client.query('ROLLBACK');
        client.release();
    }
}

module.exports = new ChatRepository();
