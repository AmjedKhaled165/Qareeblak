// API Client for Qareeblak Backend
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
// Ensure we don't duplicate /api if it's already in the base URL
const BASE_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

// Helper function for API calls
export async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('halan_token') || localStorage.getItem('qareeblak_token')) : null;

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

    const response = await fetch(url, {
        cache: 'no-store', // Ensure we always get fresh data
        ...options,
        headers
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error(`API Error (${endpoint}) -> ${url}: Received non-JSON response`, text.substring(0, 200));
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ في الطلب');
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

    logout() {
        localStorage.removeItem('qareeblak_token');
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
    }) {
        return apiCall('/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getByProvider(providerId: string) {
        return apiCall(`/bookings/provider/${providerId}`);
    },

    async getByUser(userId: string) {
        return apiCall(`/bookings/user/${userId}`);
    },

    async getAll() {
        return apiCall('/bookings');
    },

    async updateStatus(id: string, status: string) {
        return apiCall(`/bookings/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
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

export default {
    auth: authApi,
    providers: providersApi,
    services: servicesApi,
    bookings: bookingsApi,
    users: usersApi
};
