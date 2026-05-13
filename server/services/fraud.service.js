const logger = require('../utils/logger');

/**
 * [ENTERPRISE GRADE] Fraud Intelligence Service
 * Implements Median Baselines, Graph Linkage, and Learning Feedback.
 */
class FraudService {
    /**
     * Translates technical risk signals into human-readable reasons
     */
    getHumanReason(signals) {
        const map = {
            'MEDIAN_SPIKE': 'حجم المعاملة أكبر بكثير من المعتاد لهذا الحساب.',
            'FREQ_SPIKE': 'عدد العمليات في وقت قصير مريب جداً.',
            'DEVICE_LINKAGE': 'هذا الجهاز مرتبط بعدة حسابات مشبوهة.',
            'GEOGRAPHIC_JUMP': 'تم رصد محاولة دخول من موقع جغرافي غير معتاد.',
            'REPEATED_FAILURE': 'فشل متكرر في محاولات الدفع.'
        };
        return signals.map(s => map[s.split(':')[0]] || s).join(' | ');
    }

    async evaluateTransactionRisk(userId, amount, ipAddress, deviceId, client) {
        let riskScore = 0;
        const signals = [];
        const { client: redisClient } = require('../utils/redis');

        // 1. STABLE BASELINE: Using Median (PERCENTILE_CONT 0.5) to avoid outlier noise
        let medianVolume = 300;
        const baselineCacheKey = `fraud:baseline:${userId}`;
        
        if (redisClient?.status === 'ready') {
            const cached = await redisClient.get(baselineCacheKey);
            if (cached) medianVolume = parseFloat(cached);
        }

        if (medianVolume === 300) {
            const baselineRes = await client.query(`
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hourly_sum) as median_volume
                FROM (
                    SELECT SUM(ABS(amount)) as hourly_sum
                    FROM wallet_transactions
                    WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = $1)
                      AND created_at > NOW() - interval '30 days'
                    GROUP BY date_trunc('hour', created_at)
                ) sub
            `, [userId]);
            if (baselineRes.rows[0]?.median_volume) {
                medianVolume = parseFloat(baselineRes.rows[0].median_volume);
            }
            if (redisClient?.status === 'ready') {
                // Cache the heavy calculation for 24 hours
                await redisClient.set(baselineCacheKey, medianVolume, 'EX', 24 * 60 * 60);
            }
        }

        const dynamicLimit = Math.max(medianVolume * 4, 1500); 

        // 2. SIGNAL: Volume vs Median (Weighted: 40)
        // This is a fast query over the last hour, safe to execute live
        const hourlyRes = await client.query(`
            SELECT SUM(ABS(amount)) as volume, COUNT(*) as tx_count
            FROM wallet_transactions
            WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = $1)
              AND created_at > NOW() - interval '1 hour'
        `, [userId]);

        const currentVolume = parseFloat(hourlyRes.rows[0].volume || 0);
        if (currentVolume + Math.abs(amount) > dynamicLimit) {
            riskScore += 40;
            signals.push(`MEDIAN_SPIKE: ${currentVolume + amount} vs median-limit ${dynamicLimit}`);
        }

        // 3. GRAPH LINKAGE: Same Device across multiple accounts (Weighted: 60)
        if (deviceId) {
            let linkedCount = 0;
            const deviceCacheKey = `fraud:device_linkage:${deviceId}`;
            
            if (redisClient?.status === 'ready') {
                const cached = await redisClient.get(deviceCacheKey);
                if (cached) linkedCount = parseInt(cached);
            }
            
            if (!linkedCount) {
                const graphRes = await client.query(`
                    SELECT COUNT(DISTINCT wallet_id) as linked_accounts
                    FROM wallet_transactions
                    WHERE device_id = $1 AND created_at > NOW() - interval '24 hours'
                `, [deviceId]);
                linkedCount = parseInt(graphRes.rows[0].linked_accounts);
                
                if (redisClient?.status === 'ready') {
                    // Cache device linkage check for 6 hours
                    await redisClient.set(deviceCacheKey, linkedCount, 'EX', 6 * 60 * 60);
                }
            }

            if (linkedCount > 2) {
                riskScore += 60;
                signals.push(`DEVICE_LINKAGE: ${linkedCount} accounts on same device`);
            }
        }

        // 4. LEARNING LOOP: Check for previous manual "confirmed_fraud" labels
        let fraudCount = 0;
        const historyCacheKey = `fraud:history:${userId}`;
        
        if (redisClient?.status === 'ready') {
            const cached = await redisClient.get(historyCacheKey);
            if (cached) fraudCount = parseInt(cached);
        }

        if (fraudCount === 0) {
            const fraudHistory = await client.query(`
                SELECT COUNT(*) as fraud_count 
                FROM wallet_transactions 
                WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = $1) 
                  AND manual_label = 'fraud'
            `, [userId]);
            fraudCount = parseInt(fraudHistory.rows[0].fraud_count);
            
            if (redisClient?.status === 'ready' && fraudCount === 0) {
                // Only cache if clean, so if they get flagged we evaluate live next time
                await redisClient.set(historyCacheKey, fraudCount, 'EX', 24 * 60 * 60);
            }
        }
        
        if (fraudCount > 0) {
            riskScore += 100; // Block immediately if they have a confirmed fraud history
            signals.push(`PRIOR_FRAUD: User has confirmed fraudulent history`);
        }

        // Final Decision
        let action = 'ALLOW';
        if (riskScore >= 90) action = 'BLOCK';
        else if (riskScore >= 50) action = 'REVIEW';

        return {
            score: riskScore,
            action,
            signals,
            humanReason: this.getHumanReason(signals),
            metadata: { medianVolume, dynamicLimit, deviceId }
        };
    }
}

module.exports = new FraudService();
