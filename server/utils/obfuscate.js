const crypto = require('crypto');

const SECRET = process.env.OBFUSCATE_SALT || process.env.JWT_SECRET || 'qareeblak-secret-salt';

function deriveKey(salt) {
    return crypto.createHash('sha256').update(SECRET + ':' + salt).digest();
}

const FIXED_IV = crypto.createHash('md5').update(SECRET).digest().subarray(0, 16);

function encodeEntityId(entity, id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num < 0) return String(id);

    const plaintext = `${entity}:${num}:${SECRET.substring(0, 4)}`;
    const key = deriveKey(entity);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, FIXED_IV);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64url');
    encrypted += cipher.final('base64url');

    return encrypted;
}

function decodeEntityId(entity, hash) {
    if (!hash || typeof hash !== 'string') return null;

    // Do NOT fallback to parseInt here for plain integers, otherwise it ruins tracking fallback logic
    // where trackOrderPublic needs to determine if it's a booking, parent_order, or halan_order.

    try {
        const key = deriveKey(entity);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, FIXED_IV);
        let decrypted = decipher.update(hash, 'base64url', 'utf8');
        decrypted += decipher.final('utf8');

        const parts = decrypted.split(':');
        if (parts.length >= 2 && parts[0] === entity) {
            const id = parseInt(parts[1], 10);
            if (!isNaN(id) && id >= 0) return id;
        }
        return null;
    } catch {
        return null;
    }
}

function obfuscateOrder(order) {
    if (!order) return order;

    const encode = (id, entity = 'order') => id ? encodeEntityId(entity, id) : null;

    const result = {
        ...order,
        display_id: order.id, // Store raw numeric ID for display
        id: encode(order.id, 'order'),
        order_number: String(order.id),
        ...(order.courier_id ? { courier_id: Number(order.courier_id), courierId: encode(order.courier_id, 'user') } : {}),
        ...(order.supervisor_id ? { supervisor_id: Number(order.supervisor_id), supervisorId: encode(order.supervisor_id, 'user') } : {}),
        ...(order.customer_id ? { customer_id: Number(order.customer_id) } : {}),
        ...(order.sub_orders ? { sub_orders: order.sub_orders.map(s => ({
            ...s,
            display_id: s.display_id || s.id,
            id: encode(s.id, 'booking')
        })) } : {}),
    };

    if (result.provider_id) {
        result.provider_id = encode(result.provider_id, 'provider');
    }
    if (result.b_price) {
        result.price = Number(result.b_price) || result.price;
    }

    return result;
}

function obfuscateUser(user) {
    if (!user) return user;
    return {
        ...user,
        display_id: user.id,
        id: encodeEntityId('user', user.id),
    };
}

module.exports = {
    encodeEntityId,
    decodeEntityId,
    obfuscateOrder,
    obfuscateUser,
};
