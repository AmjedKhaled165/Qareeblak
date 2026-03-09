const db = require('../db');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

/**
 * 💳 [ELITE] Wallet Management Service
 * Handles user balances, loyalty credits, and refund processing.
 */
class WalletService {
    async getOrCreateWallet(userId, client = db) {
        // Atomic insert or select
        const result = await client.query(`
            INSERT INTO wallets (user_id) 
            VALUES ($1) 
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING *
        `, [userId]);
        return result.rows[0];
    }

    async updateBalance(userId, amount, type, purpose, referenceId) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const wallet = await this.getOrCreateWallet(userId, client);
            const newBalance = parseFloat(wallet.balance) + parseFloat(amount);

            if (newBalance < 0) {
                throw new AppError('Insufficient wallet balance', 400);
            }

            // Update balance
            await client.query(`
                UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2
            `, [newBalance, wallet.id]);

            // Log transaction
            await client.query(`
                INSERT INTO wallet_transactions (wallet_id, amount, type, purpose, reference_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [wallet.id, amount, type, purpose, referenceId]);

            await client.query('COMMIT');
            return { balance: newBalance };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

/**
 * 🏷️ [ELITE] Promo Engine Service
 * Validates and calculates discounts for bookings.
 */
class PromoService {
    async validateCode(code, orderValue, client = db) {
        // [AUDIT] Row-level lock (FOR UPDATE) to prevent race conditions during usage limit checks
        const result = await client.query(`
            SELECT * FROM promo_codes 
            WHERE code = $1 AND is_active = TRUE AND (expires_at > NOW() OR expires_at IS NULL)
            FOR UPDATE
        `, [code]);

        const promo = result.rows[0];
        if (!promo) throw new AppError('Invalid or expired promo code', 404);

        if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
            throw new AppError('Promo code usage limit reached', 400);
        }

        if (orderValue < promo.min_order_value) {
            throw new AppError(`Minimum order value for this code is ${promo.min_order_value} EGP`, 400);
        }

        let discount = 0;
        if (promo.discount_type === 'percentage') {
            discount = (orderValue * promo.discount_value) / 100;
            if (promo.max_discount) discount = Math.min(discount, promo.max_discount);
        } else {
            discount = promo.discount_value;
        }

        return { promoId: promo.id, discount };
    }

    async incrementUsage(promoId, client = db) {
        await client.query(`
            UPDATE promo_codes 
            SET usage_count = usage_count + 1, updated_at = NOW() 
            WHERE id = $1
        `, [promoId]);
    }
}

module.exports = {
    WalletService: new WalletService(),
    PromoService: new PromoService()
};
