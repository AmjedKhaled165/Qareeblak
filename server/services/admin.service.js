const adminRepo = require('../repositories/admin.repository');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class AdminService {
    async audit(adminId, action, entityType, entityId, details, oldValue, newValue, ip) {
        try {
            await adminRepo.logAction({ adminId, action, entityType, entityId, details, oldValue, newValue, ip });
        } catch (err) {
            logger.error('[Audit] Failed to log action:', err.message);
        }
    }

    async getOrdersWithPagination(query) {
        const { page = 1, limit = 25, status, type, search, sort = 'created_at', order = 'DESC' } = query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const allowedSorts = ['created_at', 'price', 'id', 'status'];
        const sortCol = allowedSorts.includes(sort) ? `b.${sort}` : 'b.created_at';
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

        return await adminRepo.getOrders({
            status, type, search, sortCol, sortOrder, limit: parseInt(limit), offset
        });
    }

    async forceEditOrder(adminId, id, body, ip) {
        const old = await adminRepo.getOrderWithDetails(id);
        if (!old) return null;

        const { price, delivery_fee, notes, items } = body;
        const updates = {};
        if (price !== undefined) updates.price = price;
        if (delivery_fee !== undefined) updates.delivery_fee = delivery_fee;
        if (notes !== undefined) updates.notes = notes;

        if (Object.keys(updates).length > 0) {
            await adminRepo.updateBooking(id, updates);
        }

        if (items && Array.isArray(items)) {
            await adminRepo.replaceBookingItems(id, items);
        }

        await this.audit(adminId, 'force_edit', 'order', id, `Force edited order #${id}`, old, body, ip);
        return true;
    }

    async reassign(adminId, id, body, ip) {
        const old = await adminRepo.getOrderWithDetails(id);
        if (!old) return null;

        await adminRepo.updateBooking(id, body);
        await this.audit(adminId, 'reassign', 'order', id, `Reassigned order #${id}`, old, body, ip);
        return true;
    }

    async forceStatus(adminId, id, body, ip) {
        const { status, reason } = body;
        const old = await adminRepo.getOrderWithDetails(id);
        if (!old) return null;

        await adminRepo.updateBooking(id, { status });
        await this.audit(adminId, 'force_status', 'order', id, `Force status: ${old.status} → ${status}. Reason: ${reason || 'N/A'}`, old, body, ip);
        return true;
    }

    async resetPassword(adminId, targetUserId, newPassword, ip) {
        const hashed = await bcrypt.hash(newPassword, 10);
        await adminRepo.updateUser(targetUserId, { password: hashed });
        await this.audit(adminId, 'reset_password', 'user', targetUserId, `Reset password for user #${targetUserId}`, null, null, ip);
    }
}

module.exports = new AdminService();
