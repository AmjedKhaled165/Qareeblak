/**
 * Fix Chat ID Type Mismatch
 * Changes consultations.id and chat_messages.consultation_id from INTEGER to VARCHAR
 */
const db = require('../db');
const logger = require('../utils/logger');

async function fixChatSchema() {
    const query = (text, params) => db.query(text, params);
    
    try {
        logger.info('🔄 Starting Chat Schema Fix (Integer -> VARCHAR)...');

        // 1. Check if consultations table exists and its ID type
        const checkConsult = await query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'consultations' AND column_name = 'id'
        `);

        if (checkConsult.rows.length > 0 && checkConsult.rows[0].data_type === 'integer') {
            logger.info('Converting consultations.id to VARCHAR(100)...');
            
            // We need to drop FKs temporarily
            await query(`ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_consultation_id_fkey`);
            
            // Convert consultation_id in messages first
            await query(`ALTER TABLE chat_messages ALTER COLUMN consultation_id TYPE VARCHAR(100)`);
            
            // Convert id in consultations
            await query(`ALTER TABLE consultations ALTER COLUMN id TYPE VARCHAR(100)`);
            
            // Restore FK if needed, or leave it as loose coupling if the IDs are generated via code logic
            // Given the generated IDs like 'chat_1_2', a loose coupling might be safer during migration
            logger.info('✅ Chat schema converted successfully.');
        } else {
            logger.info('Chat schema already VARCHAR or not found. Skipping.');
        }

        // 2. Ensure indexes for the new VARCHAR columns
        await query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation_id_str ON chat_messages(consultation_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_consultations_id_str ON consultations(id)`);

        return true;
    } catch (err) {
        logger.error('❌ Chat Fix Migration Error:', err);
        return false;
    }
}

module.exports = fixChatSchema;
