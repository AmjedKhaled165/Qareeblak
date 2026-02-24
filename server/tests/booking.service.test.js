const BookingService = require('../services/booking.service');
const bookingRepo = require('../repositories/booking.repository');

// Mock repositories
jest.mock('../repositories/booking.repository');

describe('BookingService - Scalability Tests', () => {
    let bookingService;

    beforeEach(() => {
        bookingService = new BookingService();
        jest.clearAllMocks();
    });

    test('checkoutTransaction should handle large number of items efficiently', async () => {
        const userId = 1;
        const items = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            providerId: i % 5, // 5 different providers
            providerName: `Provider ${i % 5}`,
            price: 10,
            quantity: 1
        }));
        const addressInfo = { phone: '123', area: 'Cairo', details: 'Street' };

        bookingRepo.beginTransaction.mockResolvedValue({ query: jest.fn(), release: jest.fn() });
        bookingRepo.createParentOrder.mockResolvedValue(100);
        bookingRepo.createBookingItem.mockResolvedValue(1);

        const result = await bookingService.checkoutTransaction(userId, items, addressInfo);

        expect(result.parentId).toBe(100);
        expect(bookingRepo.createBookingItem).toHaveBeenCalledTimes(5); // 5 unique providers
    });
});
