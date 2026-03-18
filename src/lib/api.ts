const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
// Ensure we don't duplicate /api if it's already in the base URL
const BASE_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

// Check if we should use mock API for development
const USE_MOCK_API = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

// ⏱️ Timeout wrapper for fetch requests
function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 15000): Promise<Response> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('TIMEOUT'));
        }, timeout);

        fetch(url, options)
            .then(response => {
                clearTimeout(timer);
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRequestTimeout(endpoint: string, options: RequestInit): number {
    const method = (options.method || 'GET').toUpperCase();

    // Provider list can be heavy on production DBs, so allow more time.
    if (endpoint.includes('/providers') && method === 'GET') {
        return 30000;
    }

    // Order creation may include multiple writes/validations.
    if (endpoint.includes('/orders') && method === 'POST') {
        return 30000;
    }

    return 15000;
}

// Types for API Responses
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    token?: string;
}

// Helper to get the correct auth token from storage
function getAuthToken(endpoint: string): string | null {
    if (typeof window === 'undefined') return null;

    // Prioritize halan_token for partner/admin endpoints
    const isHalanEndpoint = endpoint.includes('/halan') ||
        endpoint.includes('/providers') ||
        endpoint.includes('/auth/provider');

    let token: string | null = null;
    if (isHalanEndpoint) {
        // Halan/partner routes should prefer the dedicated partner token,
        // but can fallback to regular token for shared admin/provider APIs.
        token = localStorage.getItem('halan_token') || localStorage.getItem('qareeblak_token');
        if (token && endpoint.includes('/halan')) {
            console.log('[API] Using Halan token for endpoint:', endpoint.substring(0, 30));
        }
    } else {
        // Non-Halan routes must never fallback to halan_token,
        // otherwise stale partner sessions can break normal customer auth.
        token = localStorage.getItem('qareeblak_token');
    }
    
    if (!token && endpoint.includes('/halan')) {
        console.warn('[API] ⚠️ No token found for Halan endpoint:', endpoint);
    }
    
    return token;
}

// Helper function for API calls
export async function apiCall<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getAuthToken(endpoint);

    // Clean up endpoint: remove leading / and leading api/ if present to avoid duplication
    const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/^api\//, '');

    // Construct final URL
    const url = `${BASE_URL}/${cleanEndpoint}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const method = (options.method || 'GET').toUpperCase();
    const timeout = getRequestTimeout(endpoint, options);
    const maxAttempts = method === 'GET' ? 2 : 1;

    let response: Response;
    try {
        let lastTimeoutError: Error | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                response = await fetchWithTimeout(url, {
                    cache: 'no-store', // Ensure we always get fresh data
                    ...options,
                    headers
                }, timeout);

                // Success: stop retry loop.
                lastTimeoutError = null;
                break;
            } catch (error: any) {
                if (error?.message !== 'TIMEOUT') {
                    throw error;
                }

                lastTimeoutError = error;

                if (attempt < maxAttempts) {
                    console.warn(`⏱️ Timeout for ${endpoint}, retrying (${attempt}/${maxAttempts - 1})...`);
                    await sleep(500);
                    continue;
                }
            }
        }

        if (lastTimeoutError) {
            throw lastTimeoutError;
        }
    } catch (error: any) {
        if (error.message === 'TIMEOUT') {
            console.error(`⏱️ Request timeout for ${endpoint} (${timeout}ms)`);
            throw new Error('انتهت مهلة الطلب. يرجى التحقق من حالة الطلب في سجل الطلبات.');
        }
        throw error;
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error(`API Error (${endpoint}) -> ${url}: Received non-JSON response`, text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
        // Detailed error logging for debugging 401 and other issues
        const isHalanEndpoint = endpoint.includes('/halan');
        const halanToken = localStorage.getItem('halan_token');
        const qareeblakToken = localStorage.getItem('qareeblak_token');
        
        console.error(`❌ API Error (${endpoint}):`, {
            status: response.status,
            statusText: response.statusText,
            url: url,
            hasToken: !!token,
            tokenType: token ? (token.startsWith('ey') ? 'JWT' : 'Other') : 'none',
            isHalanEndpoint,
            halanTokenSet: !!halanToken,
            qareeblakTokenSet: !!qareeblakToken,
            error: data?.error || data?.message,
            fullResponse: data
        });

        // Handle different error scenarios
        if (response.status === 404) {
            throw new Error(`الطلب غير موجود (${response.status}) - ${endpoint}`);
        } else if (response.status === 401) {
            console.warn(`[API] 401 Unauthorized for ${endpoint}.`);
            console.log('[API] Current token status:', {
                hasToken: !!token,
                isHalanEndpoint,
                halanTokenExists: !!halanToken,
                qareeblakTokenExists: !!qareeblakToken
            });

            // If /auth/me fails with 401, the persisted session is stale/invalid.
            // Clear stale local session to stop repeated unauthorized polling loops.
            if (cleanEndpoint === 'auth/me' && typeof window !== 'undefined') {
                localStorage.removeItem('qareeblak_token');
                localStorage.removeItem('qareeblak_user');
                localStorage.removeItem('user');
                // Clear partner artifacts too to stop mixed-session loops.
                localStorage.removeItem('halan_token');
                localStorage.removeItem('halan_user');
            }

            throw new Error(data?.error || data?.message || `عدم التفويض - يرجى تسجيل الدخول`);
        } else if (response.status === 500) {
            throw new Error(`خطأ في الخادم (${response.status}) - حاول مرة أخرى لاحقاً`);
        }

        throw new Error(data?.error || data?.message || `حدث خطأ في الطلب (${response.status})`);
    }

    return data;
}

// ==================== AUTH API ====================
export const authApi = {
    async register(name: string, email: string, password: string, userType: string = 'customer') {
        const result = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, userType })
        });
        if (result.token) {
            localStorage.setItem('qareeblak_token', result.token);
            localStorage.removeItem('halan_token');
        }
        return result;
    },

    async login(email: string, password: string) {
        const result = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (result.token) {
            localStorage.setItem('qareeblak_token', result.token);
            localStorage.removeItem('halan_token');
        }
        return result;
    },

    async guestLogin() {
        const result = await apiCall('/auth/guest-login', {
            method: 'POST'
        });
        if (result.token) {
            localStorage.setItem('qareeblak_token', result.token);
            localStorage.removeItem('halan_token');
        }
        return result;
    },

    async getCurrentUser() {
        return apiCall('/auth/me');
    },

    async submitProviderRequest(data: {
        name: string;
        email: string;
        password: string;
        phone: string;
        category: string;
        location: string;
    }) {
        return apiCall('/auth/provider-request', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateProfile(data: {
        name?: string;
        email?: string;
        phone?: string;
        avatar?: string;
        oldPassword?: string;
        newPassword?: string;
    }) {
        return apiCall('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    logout() {
        localStorage.removeItem('qareeblak_token');
        localStorage.removeItem('halan_token'); // Clear Halan token too
    }
};

// ==================== REQUESTS API (Admin) ====================
export const requestsApi = {
    async getAll() {
        return apiCall('/auth/requests');
    },

    async approve(id: string) {
        return apiCall(`/auth/requests/${id}/approve`, {
            method: 'POST'
        });
    },

    async reject(id: string) {
        return apiCall(`/auth/requests/${id}/reject`, {
            method: 'POST'
        });
    }
};

// ==================== PROVIDERS API ====================
export const providersApi = {
    async getAll() {
        const result = await apiCall<any>('/providers');

        // Backend list endpoint may return either an array or a paginated object.
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.providers)) return result.providers;
        return [];
    },

    async getById(id: string) {
        return apiCall(`/providers/${id}`);
    },

    async getByEmail(email: string) {
        return apiCall(`/providers/by-email/${encodeURIComponent(email)}`);
    },

    async addReview(providerId: string, data: { userName: string; rating: number; comment: string }) {
        return apiCall(`/providers/${providerId}/reviews`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async delete(id: string) {
        return apiCall(`/providers/${id}`, {
            method: 'DELETE'
        });
    }
};

// ==================== SERVICES API ====================
export const servicesApi = {
    async add(data: {
        providerId: string;
        name: string;
        description?: string;
        price: number;
        image?: string;
        offer?: {
            type: 'discount' | 'bundle';
            discountPercent?: number;
            bundleCount?: number;
            bundleFreeCount?: number;
            endDate?: string;
        };
    }) {
        return apiCall('/services', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async update(id: string, data: any) {
        return apiCall(`/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(id: string) {
        return apiCall(`/services/${id}`, {
            method: 'DELETE'
        });
    },

    async getByProvider(providerId: string) {
        return apiCall(`/services/provider/${providerId}`);
    }
};

// ==================== BOOKINGS API ====================
export const bookingsApi = {
    async create(data: {
        userId?: string | number;
        providerId: string;
        serviceId?: string;
        userName: string;
        serviceName: string;
        providerName: string;
        price?: number;
        details?: string;
        items?: any[];
        bundleId?: string;
    }) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.create(data);
        }
        return apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async checkout(data: {
        userId: string | number;
        items: any[];
        addressInfo?: any;
        userPrizeId?: number;
    }) {
        if (USE_MOCK_API) {
            // No mock implementation for checkout yet, fallback to single calls or error
            console.warn('Mock checkout not implemented');
            return { success: false };
        }
        return apiCall('/bookings/checkout', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getById(id: string) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.getById(id);
        }
        return apiCall(`/bookings/${id}`);
    },

    async update(id: string, data: { items?: any[]; status?: string; halanOrderId?: number }) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.update(id, data);
        }
        return apiCall(`/bookings/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    async getByProvider(providerId: string, page: number = 1, limit: number = 10) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.getByProvider(providerId);
        }
        const response = await apiCall(`/bookings/provider/${providerId}?page=${page}&limit=${limit}`);
        // Backend returns: { bookings: Booking[], pagination: { page, limit, total, totalPages } }
        return response;
    },

    async getByUser(userId: string) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.getByUser(userId);
        }
        return apiCall(`/bookings/user/${userId}`);
    },

    async getAll() {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.getAll();
        }
        return apiCall('/bookings');
    },

    async updateStatus(id: string, status: string, price?: number) {
        if (USE_MOCK_API) {
            const { mockBookingsApi } = await import('./mock-api');
            return mockBookingsApi.updateStatus(id, status);
        }
        return apiCall(`/bookings/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, price })
        });
    }
};
// ==================== USERS API (Partner Profile) ====================
export const usersApi = {
    async updateUser(userId: number, data: {
        name_ar?: string;
        email?: string;
        phone?: string;
        avatar?: string;
        oldPassword?: string;
        newPassword?: string;
    }) {
        return apiCall(`/halan/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
};

// ==================== WHEEL API ====================
export const wheelApi = {
    async getPrizes() {
        return apiCall('/wheel/prizes');
    },

    async spin() {
        return apiCall('/wheel/spin', {
            method: 'POST'
        });
    },

    async getMyPrizes() {
        return apiCall('/wheel/my-prizes');
    },

    // Admin
    async adminGetPrizes() {
        return apiCall('/wheel/admin/prizes');
    },

    async adminAddPrize(data: any) {
        return apiCall('/wheel/admin/prizes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async adminUpdatePrize(id: number, data: any) {
        return apiCall(`/wheel/admin/prizes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async adminDeletePrize(id: number) {
        return apiCall(`/wheel/admin/prizes/${id}`, {
            method: 'DELETE'
        });
    }
};

export default {
    auth: authApi,
    providers: providersApi,
    services: servicesApi,
    bookings: bookingsApi,
    users: usersApi,
    wheel: wheelApi
};
