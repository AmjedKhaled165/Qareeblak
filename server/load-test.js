import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * 🚀 [ELITE] k6 Stress Test
 * Goal: Verify Distributed Locking and Rate Limiting survival under 500 VU load.
 */

export const options = {
    stages: [
        { duration: '30s', target: 100 }, // Ramp-up
        { duration: '1m', target: 500 },  // High load
        { duration: '30s', target: 0 },   // Ramp-down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'], // <1% errors
        http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    },
};

const BASE_URL = 'http://localhost:5000/api';

export default function () {
    // 1. Attempt Brute Force Auth
    const authRes = http.post(`${BASE_URL}/auth/login`, {
        username: 'test_user',
        password: 'wrong_password',
    });
    check(authRes, {
        'auth rate limited or rejected': (r) => r.status === 401 || r.status === 429,
    });

    // 2. High Concurrency Checkout (Tests Logic Locks)
    const checkoutPayload = JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        address: '123 Chaos Street',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_TEST_JWT_HERE',
        },
    };

    const checkRes = http.post(`${BASE_URL}/bookings/checkout`, checkoutPayload, params);

    check(checkRes, {
        'checkout processed or locked': (r) => r.status === 200 || r.status === 429 || r.status === 409,
    });

    sleep(0.5);
}
