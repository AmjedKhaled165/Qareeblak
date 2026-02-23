// API Client for Qareeblak Backend
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
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

    if (isHalanEndpoint) {
        return localStorage.getItem('halan_token') || localStorage.getItem('qareeblak_token');
    }

    return localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');
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

    // ⏱️ Determine timeout based on endpoint (longer for order creation)
    const timeout = endpoint.includes('/orders') && options.method === 'POST'
        ? 30000  // 30 seconds for order creation
        : 15000; // 15 seconds for other requests

    let response: Response;
    try {
        response = await fetchWithTimeout(url, {
            cache: 'no-store', // Ensure we always get fresh data
            ...options,
            headers
        }, timeout);
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
        console.error(`❌ API Error (${endpoint}):`, {
            status: response.status,
            statusText: response.statusText,
            url: url,
            hasToken: !!token,
            tokenType: token ? (token.startsWith('ey') ? 'JWT' : 'Other') : 'none',
            error: data?.error || data?.message,
            fullResponse: data
        });

        // Handle different error scenarios
        if (response.status === 404) {
            throw new Error(`الطلب غير موجود (${response.status}) - ${endpoint}`);
        } else if (response.status === 401) {
            console.warn(`[API] 401 Unauthorized for ${endpoint}.`);

            // Check which token was actually used so we clear the right session
            const isHalanRequest = endpoint.includes('/halan') || endpoint.includes('/providers');

            if (typeof window !== 'undefined') {
                if (isHalanRequest) {
                    console.log('[API] Clearing Halan session due to 401');
                    localStorage.removeItem('halan_token');
                    localStorage.removeItem('halan_user');
                } else {
                    console.log('[API] Clearing Qareeblak session due to 401');
                    localStorage.removeItem('qareeblak_token');
                    localStorage.removeItem('user'); // Qareeblak user key
                }

                // If on a page that requires this auth, trigger a reload or redirect
                // But we'll let the component's useEffect handle the missing session
            }

            throw new Error(data?.error || data?.message || `عدم التفويض - يرجى تسجيل الدخول`);
        } else if (response.status === 500) {
            throw new Error(`خطأ في الخادم (${response.status}) - حاول مرة أخرى لاحقاً`);
        }

        throw new Error(data?.error || data?.message || `حدث خطأ في الطلب (${response.status})`);
    }

    // 🌐 Log successful order requests to verify 'source' field is included
    if (endpoint.includes('/orders') && data.data) {
        if (Array.isArray(data.data)) {
            console.log('📋 Orders fetched - Source field check:', {
                count: data.data.length,
                sources: data.data.map((o: any) => ({
                    id: o.id,
                    source: o.source,
                    customer: o.customer_name
                }))
            });
        } else if (data.data.id) {
            console.log('📦 Order fetched:', {
                id: data.data.id,
                source: data.data.source,
                customer: data.data.customer_name
            });
        }
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
        return apiCall('/providers');
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
