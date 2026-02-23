const providerRepo = require('../repositories/provider.repository');
const logger = require('../utils/logger');

class ProviderService {
    constructor() {
        this.cache = { data: null, timestamp: 0 };
        this.TTL = 60000;
    }

    async getProviders() {
        const now = Date.now();
        const cacheKey = 'providers:all:with-details';

        // Internal memory cache (1 min)
        if (this.cache.data && now - this.cache.timestamp < this.TTL) {
            return this.cache.data;
        }

        const providersRaw = await providerRepo.getAllApprovedWithDetails();

        const providers = providersRaw.map(p => {
            const provider = { ...p };
            provider.services = this._formatServices(p.services_raw || []);
            provider.reviewsList = this._formatReviews(p.reviews_raw || []);
            this._sanitizeProvider(provider);
            delete provider.services_raw;
            delete provider.reviews_raw;
            return provider;
        });

        this.cache.data = providers;
        this.cache.timestamp = now;
        return providers;
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
