const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required but not set in environment!');
}

async function findHalanUserByIdentifier(identifier) {
    const normalized = identifier.trim();

    try {
        // Preferred path when username column exists.
        return await pool.query(
            `SELECT * FROM users
             WHERE (
                LOWER(username) = LOWER($1)
                OR LOWER(email) = LOWER($1)
                OR phone = $1
                OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
             )
             AND LOWER(COALESCE(user_type, '')) IN ('partner_owner', 'partner_supervisor', 'partner_courier', 'owner', 'supervisor', 'courier')`,
            [normalized]
        );
    } catch (error) {
        // Fallback for legacy backups where users.username does not exist.
        if (error && error.code === '42703') {
            return pool.query(
                `SELECT *, NULL::text AS username FROM users
                 WHERE (
                    LOWER(email) = LOWER($1)
                    OR phone = $1
                    OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
                 )
                 AND LOWER(COALESCE(user_type, '')) IN ('partner_owner', 'partner_supervisor', 'partner_courier', 'owner', 'supervisor', 'courier')`,
                [normalized]
            );
        }
        throw error;
    }
}

function toCanonicalPartnerType(rawType) {
    const type = String(rawType || '').toLowerCase();
    if (type === 'partner_owner' || type === 'owner') return 'partner_owner';
    if (type === 'partner_supervisor' || type === 'supervisor') return 'partner_supervisor';
    if (type === 'partner_courier' || type === 'courier') return 'partner_courier';
    return null;
}

function toRoleLabel(canonicalType) {
    if (canonicalType === 'partner_owner') return 'owner';
    if (canonicalType === 'partner_supervisor') return 'supervisor';
    if (canonicalType === 'partner_courier') return 'courier';
    return null;
}

exports.login = catchAsync(async (req, res) => {
    const { identifier, password } = req.body;

    const result = await findHalanUserByIdentifier(identifier);

    if (result.rows.length === 0) throw new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

    const user = result.rows[0];
    const rawPassword = String(user.password || '');
    const incomingPassword = password.trim();
    const hasBcryptHash = rawPassword.startsWith('$2a$') || rawPassword.startsWith('$2b$') || rawPassword.startsWith('$2y$');

    let validPassword = false;
    if (hasBcryptHash) {
        validPassword = await bcrypt.compare(incomingPassword, rawPassword);
    } else {
        // Legacy fallback: allow plaintext passwords once, then migrate to hash.
        validPassword = incomingPassword === rawPassword;
    }

    if (!validPassword) throw new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

    const canonicalUserType = toCanonicalPartnerType(user.user_type);
    if (!canonicalUserType) throw new AppError('نوع الحساب غير مدعوم للدخول', 403);

    const updates = [];
    const params = [];

    if (!hasBcryptHash) {
        const migratedHash = await bcrypt.hash(incomingPassword, 10);
        params.push(migratedHash);
        updates.push(`password = $${params.length}`);
    }

    if (String(user.user_type) !== canonicalUserType) {
        params.push(canonicalUserType);
        updates.push(`user_type = $${params.length}`);
    }

    if (updates.length > 0) {
        params.push(user.id);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`,
            params
        );
    }

    const role = canonicalUserType;
    const roleNormalized = toRoleLabel(canonicalUserType);
    const username = user.username || user.email || user.phone || null;

    const token = jwt.sign(
        { id: user.id, role, username },
        JWT_SECRET,
        { expiresIn: '3650d' }
    );

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                username,
                name_ar: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                role: roleNormalized,
                rawRole: role
            },
            token
        }
    });
});

exports.getMe = catchAsync(async (req, res) => {
    // req.user is already populated by verifyToken
    const user = req.user;

    const role = user.user_type;
    const roleNormalized = String(role).replace(/^partner_/, '');

    res.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            name_ar: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            role: roleNormalized,
            rawRole: role
        }
    });
});

exports.registerMember = catchAsync(async (req, res) => {
    const { name, username, email, phone, password, role, supervisorId } = req.body;

    // Auth check: Use req.user from verifyToken
    if (req.user.user_type !== 'partner_owner' && req.user.role !== 'admin') {
        throw new AppError('يسمح للمالك أو المدير فقط بإضافة مستخدمين', 403);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userType = `partner_${role}`;

    let result;
    try {
        result = await pool.query(
            `INSERT INTO users (name, username, email, phone, password, user_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, username || null, email || null, phone || null, hashedPassword, userType]
        );
    } catch (error) {
        // Legacy schema fallback where users.username does not exist.
        if (error && error.code === '42703') {
            result = await pool.query(
                `INSERT INTO users (name, email, phone, password, user_type)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [name, email || null, phone || null, hashedPassword, userType]
            );
        } else {
            throw error;
        }
    }

    const newUserId = result.rows[0].id;

    if (role === 'courier' && supervisorId) {
        await pool.query(
            `INSERT INTO courier_supervisors (courier_id, supervisor_id) VALUES ($1, $2)`,
            [newUserId, supervisorId]
        );
    }

    res.status(201).json({
        success: true,
        message: 'تم إضافة المستخدم بنجاح',
        userId: newUserId
    });
});
