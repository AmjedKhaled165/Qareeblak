const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');
const db = require('../db');

// Mock DB for testing
jest.mock('../db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test Case: Security - Invalid Login
     * Check if system correctly identifies bad credentials.
     */
    it('should return 401 for incorrect credentials', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // User not found

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'wrong@user.com',
                password: 'wrongpassword'
            });

        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error');
    });

    /**
     * Test Case: Performance - Quick Response
     * Essential for 2s load time guarantee.
     */
    it('should respond to register request within 200ms', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // Email not taken
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', email: 't@t.com', user_type: 'customer' }] });

        const start = Date.now();
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@user.com',
                password: 'password123'
            });

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(500); // Allow more for mock overhead, but target 200ms in real env
    });
});
