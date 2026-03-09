const providerRepo = require('../repositories/provider.repository');
const logger = require('../utils/logger');
const { getCache, setCache } = require('../utils/redis-cache');

const PROVIDERS_CACHE_TTL = 300; // 5 minutes (Lists are less volatile)

class ProviderService {

    async getProviders(lastId = null, limit = 20, lastRating = null, category = null) {
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
        // [ENTERPRISE] Cache key includes category and pagination anchors
        const cacheKey = `providers:list:${category || 'all'}:${lastRating || 'top'}:${lastId || 'start'}:${safeLimit}`;

        const cached = await getCache(cacheKey);
        if (cached) return cached;

        const providersRaw = await providerRepo.getProviders({
            limit: safeLimit,
            lastId: lastId ? parseInt(lastId, 10) : undefined,
            lastRating: lastRating !== null ? parseFloat(lastRating) : undefined,
            category
        });

        // [ENTERPRISE PERFORMANCE] Note: We NO LONGER aggregate services/reviews for list views.
        // This makes the response size 90% smaller and matches industry standards (Uber/Talabat).
        const providers = providersRaw.map(p => {
            const provider = { ...p };
            this._sanitizeProvider(provider);
            return provider;
        });

        const result = {
            providers,
            // Keyset anchors for next page
            nextLastId: providers.length > 0 ? providers[providers.length - 1].id : null,
            nextLastRating: providers.length > 0 ? providers[providers.length - 1].rating : null,
            hasMore: providers.length === safeLimit
        };

        await setCache(cacheKey, result, PROVIDERS_CACHE_TTL);
        return result;
    }

    async getProviderById(id) {
        const p = await providerRepo.getByIdWithDetails(id);
        if (!p) return null;

        const provider = { ...p };
        provider.services = this._formatServices(p.services_raw || []);
        provider.reviewsList = this._formatReviews(p.reviews_raw || []);
        this._sanitizeProvider(provider);
        delete provider.services_raw;
        delete provider.reviews_raw;

        return provider;
    }

    async getProviderByEmail(email) {
        const provider = await providerRepo.getByEmail(email);
        if (!provider) return null;

        const services = await providerRepo.getServices(provider.id);
        provider.services = this._formatServices(services);

        const reviews = await providerRepo.getReviews(provider.id);
        provider.reviewsList = this._formatReviews(reviews);

        this._sanitizeProvider(provider);
        return provider;
    }

    _formatServices(services) {
        return services.map(s => ({
            id: s.id.toString(),
            name: s.name,
            description: s.description,
            price: parseFloat(s.price),
            image: s.image,
            offer: s.has_offer ? {
                type: s.offer_type,
                discountPercent: s.discount_percent,
                bundleCount: s.bundle_count,
                bundleFreeCount: s.bundle_free_count,
                endDate: s.offer_end_date
            } : undefined
        }));
    }

    _formatReviews(reviews) {
        return reviews.map(r => ({
            id: r.id.toString(),
            userName: r.user_name,
            rating: r.rating,
            comment: r.comment,
            date: r.review_date
        }));
    }

    _sanitizeProvider(p) {
        p.id = p.id.toString();
        p.userId = p.user_id?.toString();
        p.isApproved = p.is_approved;
        p.joinedDate = p.joined_date;
        delete p.user_id;
        delete p.is_approved;
        delete p.joined_date;
    }
}

module.exports = new ProviderService();
