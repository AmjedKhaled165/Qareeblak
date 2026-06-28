const bookingService = require('../services/booking.service');
const bookingRepo = require('../repositories/booking.repository');
const db = require('../db');

// Mock repositories and db
jest.mock('../db', () => {
    const queryMock = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('pg_try_advisory_xact_lock')) {
            return { rows: [{ acquired: true }] };
        }
        if (sql.includes('SELECT id, price, provider_id FROM services')) {
            return {
                rows: Array.from({ length: 50 }, (_, i) => ({
                    id: i + 1,
                    price: 10,
                    provider_id: i % 5
                }))
            };
        }
        if (sql.includes('SELECT name, phone FROM users')) {
            return { rows: [{ name: 'Test User', phone: '1234567890' }] };
        }
        if (sql.includes('INSERT INTO delivery_orders')) {
            return { rows: [{ id: 123 }] };
        }
        return { rows: [] };
    });

    const clientMock = {
        query: queryMock,
        release: jest.fn()
    };

    return {
        query: queryMock,
        connect: jest.fn().mockResolvedValue(clientMock)
    };
});

jest.mock('../repositories/booking.repository');

describe('BookingService - Scalability Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('checkoutTransaction should handle large number of items efficiently', async () => {
        const userId = 1;
        const items = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            providerId: i % 5, // 5 different providers
            providerName: `Provider ${i % 5}`,
            price: 10,
            quantity: 1
        }));
        const addressInfo = { phone: '123', area: 'Cairo', details: 'Street' };

        bookingRepo.createParentOrder.mockResolvedValue(100);
        bookingRepo.createBookingItem.mockResolvedValue(1);

        const result = await bookingService.checkoutTransaction(userId, items, addressInfo);

        expect(result.parentId).toBe(100);
        expect(bookingRepo.createBookingItem).toHaveBeenCalledTimes(5); // 5 unique providers
    });
});
