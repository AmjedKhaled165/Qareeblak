import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
    try {
        const pool = new Pool({
            connectionString: 'postgresql://qareeblak_owner:npg_u24mYOGCwNjR@ep-purple-tooth-agcvtnrx.c-2.eu-central-1.aws.neon.tech/qareeblak?sslmode=require',
            ssl: { rejectUnauthorized: false }
        });

        await pool.query(`DROP TABLE IF EXISTS chat_messages CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS consultations CASCADE`);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                consultation_id INTEGER REFERENCES consultations(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                sender_type VARCHAR(50) DEFAULT 'customer',
                message TEXT,
                message_type VARCHAR(50) DEFAULT 'text',
                image_url TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.end();
        return NextResponse.json({ success: true, message: 'Tables created via Next.js API' });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
