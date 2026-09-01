const db = require('../db');
const AppError = require('../utils/appError');
const crypto = require('crypto');
const fraudService = require('./fraud.service');
const logger = require('../utils/logger');

/**
 * [ELITE MASTERCLASS - FINAL VERSION]
 * Hash-Chained Immutable Ledger with Governance Check
 */
class WalletService {
    /**
     * Calculates a unique cryptographic hash for a transaction record
     */
    generateRecordHash(walletId, amount, sequence, prevHash) {
        const data = `${walletId}|${amount}|${sequence}|${prevHash || 'ROOT'}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async updateBalance(userId, amount, type, purpose, referenceId, client, ipAddress = '0.0.0.0', deviceId = null) {
        if (!client) throw new Error('Transaction client required');

        // 1. Fetch wallet and check lock
        const walletRes = await client.query(
            'SELECT id, balance, is_locked FROM wallets WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        if (walletRes.rowCount === 0) throw new AppError('Wallet not found', 404);
        const wallet = walletRes.rows[0];

        if (wallet.is_locked) {
            throw new AppError('عذراً، هذه المحفظة مجمدة لوجود تعارض مالي. يرجى التواصل مع الدعم.', 403);
        }

        // 2. [ELITE: INTELLIGENT FRAUD CHECK]
        const assessment = await fraudService.evaluateTransactionRisk(userId, amount, ipAddress, deviceId, client);
        
        if (assessment.action === 'BLOCK') {
            await client.query('UPDATE wallets SET is_locked = TRUE WHERE id = $1', [wallet.id]);
            logger.error(`[CRITICAL FRAUD BLOCK] User ${userId} blocked. Reason: ${assessment.humanReason}`);
            throw new AppError(`تم تجميد المحفظة لأسباب أمنية: ${assessment.humanReason}`, 403);
        }

        // 3. Hash Chaining Preparation
        const lastTxRes = await client.query(
            'SELECT record_hash, sequence_number FROM wallet_transactions WHERE wallet_id = $1 ORDER BY sequence_number DESC LIMIT 1',
            [wallet.id]
        );
        const prevHash = lastTxRes.rowCount > 0 ? lastTxRes.rows[0].record_hash : 'ROOT';

        // 4. Financial Logic (Banker's Rounding)
        const roundFinancial = (num) => Math.round((num + Number.EPSILON) * 10000) / 10000;
        const newBalance = roundFinancial(parseFloat(wallet.balance) + parseFloat(amount));

        if (newBalance < 0) throw new AppError('رصيد المحفظة غير كافٍ', 400);

        // 5. Update Balance
        await client.query(
            'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2',
            [newBalance, wallet.id]
        );

        // 6. Generate Immutable Record Hash
        const nextSeq = lastTxRes.rowCount > 0 ? parseInt(lastTxRes.rows[0].sequence_number) + 1 : 1;
        const currentHash = this.generateRecordHash(wallet.id, amount, nextSeq, prevHash);

        // 7. Create Ledger Entry with Intelligence Metadata
        await client.query(`
            INSERT INTO wallet_transactions 
            (wallet_id, amount, type, purpose, reference_id, balance_after, record_hash, previous_record_hash, status, metadata, device_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            wallet.id, amount, type, purpose, referenceId, 
            newBalance, currentHash, prevHash,
            assessment.action === 'REVIEW' ? 'flagged' : 'success',
            JSON.stringify({ 
                risk_score: assessment.score, 
                signals: assessment.signals,
                reason: assessment.humanReason,
                ip: ipAddress 
            }),
            deviceId
        ]);

        return { balance: newBalance };
    }

    /**
     * Governance: Manual Unfreeze (Requires Admin Audit)
     */
    async adminUnfreezeWallet(walletId, adminId, reason, client = db) {
        await client.query('BEGIN');
        try {
            await client.query('UPDATE wallets SET is_locked = FALSE WHERE id = $1', [walletId]);
            await client.query(`
                INSERT INTO administrative_audit_log (admin_id, action, target_wallet_id, reason)
                VALUES ($1, $2, $3, $4)
            `, [adminId, 'UNFREEZE_WALLET', walletId, reason]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    }
}

/**
 * Promo Code Validation & Redemption Service
 * Validates promo codes against the promo_codes table and atomically increments usage.
 */
class PromoService {
    /**
     * Validates a promo code and marks it as used within the provided transaction client.
     * @param {string} code - The promo code string
     * @param {number} orderTotal - The order subtotal to validate min_order_value against
     * @param {object} client - PostgreSQL transaction client (required for atomicity)
     * @returns {{ discount: number }} The calculated discount amount
     */
    async validateAndUse(code, orderTotal, client) {
        if (!client) throw new Error('Transaction client required for promo validation');
        if (!code || typeof code !== 'string') throw new AppError('كود الخصم غير صالح', 400);

        const normalizedCode = code.trim().toUpperCase();

        // Lock the row to prevent concurrent redemption past usage_limit
        const result = await client.query(
            `SELECT id, discount_type, discount_value, min_order_value, max_discount, usage_limit, usage_count, expires_at, is_active
             FROM promo_codes WHERE UPPER(code) = $1 FOR UPDATE`,
            [normalizedCode]
        );

        if (result.rowCount === 0) {
            throw new AppError('كود الخصم غير موجود', 404);
        }

        const promo = result.rows[0];

        if (!promo.is_active) {
            throw new AppError('كود الخصم غير نشط', 400);
        }

        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            throw new AppError('كود الخصم منتهي الصلاحية', 400);
        }

        if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
            throw new AppError('تم استنفاد عدد مرات استخدام هذا الكود', 400);
        }

        const minOrder = Number(promo.min_order_value) || 0;
        if (orderTotal < minOrder) {
            throw new AppError(`الحد الأدنى للطلب لاستخدام هذا الكود هو ${minOrder} ج.م`, 400);
        }

        // Calculate discount using Banker's Rounding
        let discount = 0;
        if (promo.discount_type === 'percentage') {
            discount = Math.round(orderTotal * (Number(promo.discount_value) / 100) * 100) / 100;
        } else {
            // 'fixed' discount
            discount = Number(promo.discount_value);
        }

        // Cap at max_discount if set
        if (promo.max_discount !== null && discount > Number(promo.max_discount)) {
            discount = Number(promo.max_discount);
        }

        // Cap at order total to prevent negative prices
        discount = Math.min(discount, orderTotal);

        // Atomically increment usage count
        await client.query(
            'UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = $1',
            [promo.id]
        );

        return { discount };
    }
}

module.exports = { WalletService: new WalletService(), PromoService: new PromoService() };
