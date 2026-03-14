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
             WHERE (username = $1 OR email = $1 OR phone = $1)
             AND user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')`,
            [normalized]
        );
    } catch (error) {
        // Fallback for legacy backups where users.username does not exist.
        if (error && error.code === '42703') {
            return pool.query(
                `SELECT *, NULL::text AS username FROM users
                 WHERE (email = $1 OR phone = $1)
                 AND user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')`,
                [normalized]
            );
        }
        throw error;
    }
}

exports.login = catchAsync(async (req, res) => {
    const { identifier, password } = req.body;

    const result = await findHalanUserByIdentifier(identifier);

    if (result.rows.length === 0) throw new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password.trim(), user.password);
    if (!validPassword) throw new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

    const role = user.user_type; // partner_owner, partner_supervisor, partner_courier
    const roleNormalized = String(role).replace(/^partner_/, '');
    const username = user.username || user.email || user.phone || null;

    const token = jwt.sign(
        { id: user.id, role, username },
        JWT_SECRET,
        { expiresIn: '30d' }
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
