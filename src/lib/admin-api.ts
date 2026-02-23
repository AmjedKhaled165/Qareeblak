/**
 * SUPER ADMIN API — God Mode endpoints
 * All endpoints require verifyToken + isOwnerOrAdmin
 */
import { apiCall } from "./api";

// ==================== ADMIN STATS ====================
export const adminStatsApi = {
    async getDashboard() {
        return apiCall("/admin/stats");
    },
};

// ==================== ADMIN ORDERS (Operations Center) ====================
export const adminOrdersApi = {
    /** Get all orders with full join data — paginated, filterable */
    async getAll(params: {
        page?: number;
        limit?: number;
        status?: string;
        type?: string; // 'app' | 'manual' | 'maintenance'
        search?: string;
        dateFrom?: string;
        dateTo?: string;
    } = {}) {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.status) qs.set("status", params.status);
        if (params.type) qs.set("type", params.type);
        if (params.search) qs.set("search", params.search);
        if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
        if (params.dateTo) qs.set("dateTo", params.dateTo);
        return apiCall(`/admin/orders?${qs.toString()}`);
    },

    /** Get single order with full details */
    async getById(id: number | string) {
        return apiCall(`/admin/orders/${id}`);
    },

    /** Force-edit an order (price, items, delivery_fee, notes) */
    async forceEdit(id: number | string, data: {
        items?: { name: string; price: number; quantity: number }[];
        price?: number;
        delivery_fee?: number;
        notes?: string;
    }) {
        return apiCall(`/admin/orders/${id}/force-edit`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    },

    /** Re-assign courier or provider */
    async reassign(id: number | string, data: {
        courier_id?: number;
        provider_id?: number;
    }) {
        return apiCall(`/admin/orders/${id}/reassign`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    },

    /** Force status override — ignores normal validation */
    async forceStatus(id: number | string, status: string, reason: string) {
        return apiCall(`/admin/orders/${id}/force-status`, {
            method: "PATCH",
            body: JSON.stringify({ status, reason }),
        });
    },

    /** Soft delete (cancel) or hard delete */
    async remove(id: number | string, hard: boolean = false) {
        return apiCall(`/admin/orders/${id}`, {
            method: "DELETE",
            body: JSON.stringify({ hard }),
        });
    },
};

// ==================== ADMIN USERS (CRM) ====================
export const adminUsersApi = {
    /** List users by type with pagination & search */
    async getAll(params: {
        type?: string; // 'customer' | 'provider' | 'partner_courier' | 'admin'
        page?: number;
        limit?: number;
        search?: string;
        banned?: boolean;
    } = {}) {
        const qs = new URLSearchParams();
        if (params.type) qs.set("type", params.type);
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.search) qs.set("search", params.search);
        if (params.banned !== undefined) qs.set("banned", String(params.banned));
        return apiCall(`/admin/users?${qs.toString()}`);
    },

    /** Get single user with full profile */
    async getById(id: number | string) {
        return apiCall(`/admin/users/${id}`);
    },

    /** Ban/Unban toggle */
    async toggleBan(id: number | string, isBanned: boolean, reason?: string) {
        return apiCall(`/admin/users/${id}/ban`, {
            method: "PATCH",
            body: JSON.stringify({ isBanned, reason }),
        });
    },

    /** Edit user profile */
    async editProfile(id: number | string, data: {
        name?: string;
        phone?: string;
        email?: string;
        user_type?: string;
    }) {
        return apiCall(`/admin/users/${id}/edit`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    },

    /** Force password reset */
    async resetPassword(id: number | string, newPassword: string) {
        return apiCall(`/admin/users/${id}/reset-password`, {
            method: "POST",
            body: JSON.stringify({ newPassword }),
        });
    },
};

// ==================== ADMIN AUDIT LOG ====================
export const adminAuditApi = {
    async getLogs(params: {
        page?: number;
        limit?: number;
        action?: string;
        userId?: string;
        dateFrom?: string;
        dateTo?: string;
    } = {}) {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.action) qs.set("action", params.action);
        if (params.userId) qs.set("userId", params.userId);
        if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
        if (params.dateTo) qs.set("dateTo", params.dateTo);
        return apiCall(`/admin/audit-logs?${qs.toString()}`);
    },
};

// ==================== ADMIN CATALOG ====================
export const adminCatalogApi = {
    async getCategories() {
        return apiCall("/admin/catalog/categories");
    },
    async createCategory(data: { name: string; name_ar: string; icon?: string; isActive: boolean }) {
        return apiCall("/admin/catalog/categories", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },
    async updateCategory(id: number | string, data: Record<string, unknown>) {
        return apiCall(`/admin/catalog/categories/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    },
    async deleteCategory(id: number | string) {
        return apiCall(`/admin/catalog/categories/${id}`, { method: "DELETE" });
    },
};

// ==================== COURIERS LIST (for dropdowns) ====================
export const adminCouriersApi = {
    async getAvailable() {
        return apiCall("/admin/couriers/available");
    },
};
