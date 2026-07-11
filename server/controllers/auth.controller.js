const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

const crypto = require('crypto');

// [SECURITY ROTATION] Cookies lifetimes align with JWT lifetimes
const COOKIE_OPTIONS = {
    httpOnly: true, // Prevents JavaScript access (Immune to XSS)
    secure: process.env.NODE_ENV === 'production', // Only sent over HTTPS
    sameSite: 'Lax', // Protects against some CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (Refresh Token)
};

const ACCESS_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000 // 15 minutes (Access Token)
};

// [SECURITY] CSRF Cookie Option - MUST BE httpOnly: false for client to read and send in header
const CSRF_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    httpOnly: false, // Client-side JS needs to read this for Double-Submit Pattern
    sameSite: 'Strict', // Strongest protection for CSRF cookie
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

const setAuthCookies = (res, accessToken, refreshToken) => {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.cookie('csrfToken', csrfToken, CSRF_COOKIE_OPTIONS);
    return csrfToken;
};

exports.sendRegisterOtp = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب' });

    await authService.sendRegisterOtp(email);
    
    logger.info(`Registration OTP sent to: ${email}`);
    res.status(200).json({
        success: true,
        message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
    });
});

exports.register = catchAsync(async (req, res, next) => {
    const { user, accessToken, refreshToken } = await authService.registerUser(req.body);
    setAuthCookies(res, accessToken, refreshToken);

    const { obfuscateUser } = require('../utils/obfuscate');
    logger.info(`User registered successfully: ${user.email}`);
    res.status(201).json({
        success: true,
        message: 'تم التسجيل بنجاح',
        token: accessToken,
        user: obfuscateUser(user)
    });
});

exports.login = catchAsync(async (req, res, next) => {
    const { identifier, email, password } = req.body;
    const loginIdentifier = (identifier || email || '').trim();

    const { user, accessToken, refreshToken } = await authService.loginUser(loginIdentifier, password);
    setAuthCookies(res, accessToken, refreshToken);

    const { obfuscateUser } = require('../utils/obfuscate');
    const { createNotification } = require('../routes/notifications');
    logger.info(`User logged in: ${user.email}`);

    // Trigger notification
    const io = req.app.get('io');
    createNotification(user.id, 'تسجيل دخول جديد', 'تم تسجيل الدخول إلى حسابك بنجاح للتو. إذا لم تكن أنت، يرجى تغيير كلمة المرور.', 'system', null, io).catch(e => logger.error('Failed to create login notification:', e));

    res.status(200).json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: accessToken,
        user: obfuscateUser(user)
    });
});

exports.guestLogin = catchAsync(async (req, res, next) => {
    const { user, accessToken, refreshToken } = await authService.guestLogin();
    setAuthCookies(res, accessToken, refreshToken);

    const { obfuscateUser } = require('../utils/obfuscate');
    logger.info(`Guest logged in: ${user.email}`);
    res.status(200).json({
        success: true,
        message: 'تم الدخول كزائر بنجاح',
        token: accessToken,
        user: obfuscateUser(user)
    });
});

exports.getMe = catchAsync(async (req, res, next) => {
    const { obfuscateUser } = require('../utils/obfuscate');
    res.status(200).json(obfuscateUser(req.user));
});

exports.submitProviderRequest = catchAsync(async (req, res, next) => {
    await authService.submitProviderRequest(req.body);
    logger.info(`Provider request submitted: ${req.body.email}`);
    res.status(201).json({
        message: 'تم تقديم طلبك بنجاح! سيتم مراجعته من الإدارة.',
        status: 'pending'
    });
});

exports.getRequests = catchAsync(async (req, res, next) => {
    const requests = await authService.getAllRequests();
    res.status(200).json(requests);
});

exports.approveRequest = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('user', req.params.id) || req.params.id;
    await authService.approveRequest(id);
    logger.info(`Provider request approved: ${id}`);
    res.status(200).json({ message: 'تم قبول الطلب بنجاح' });
});

exports.rejectRequest = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('user', req.params.id) || req.params.id;
    await authService.rejectRequest(id);
    logger.info(`Provider request rejected: ${id}`);
    res.status(200).json({ message: 'تم رفض الطلب' });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
    const updatedUser = await authService.updateProfile(req.user.id, req.body);
    
    // Sync to providers table if applicable
    const userType = String(req.user.user_type || '').toLowerCase();
    if (['provider', 'partner', 'restaurant', 'pharmacy', 'maintenance', 'doctor', 'playground', 'market', 'library'].includes(userType)) {
        const providerRepo = require('../repositories/provider.repository');
        try {
            const providerId = await providerRepo.getProviderIdByUserId(req.user.id);
            if (providerId) {
                await providerRepo.updateProvider(providerId, req.body);
            }
        } catch (err) {
            logger.warn(`Failed to sync profile update to provider record for user ${req.user.id}: ${err.message}`);
        }
    }

    logger.info(`User profile updated: ${req.user.id}`);
    res.status(200).json({
        success: true,
        message: 'تم تحديث البيانات بنجاح',
        user: updatedUser
    });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
    await authService.forgotPassword(req.body.email);
    res.status(200).json({
        success: true,
        message: 'إذا كان البريد الإلكتروني مسجلاً، فستتلقى رمز استعادة كلمة المرور قريباً.'
    });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    res.status(200).json({
        success: true,
        message: 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.'
    });
});

exports.googleSync = catchAsync(async (req, res, next) => {
    const { name, email, googleUid, avatar, firebaseIdToken, isDevMock } = req.body;
    if (!email || (!firebaseIdToken && !isDevMock)) {
        return res.status(400).json({ success: false, error: 'البيانات غير مكتملة.' });
    }

    try {
        if (isDevMock && process.env.NODE_ENV !== 'production') {
            logger.warn(`⚠️ [DEV MODE] Mock Google Auth for ${email}`);
        } else {
            const { admin } = require('../utils/firebase');
            if (admin && admin.apps.length > 0) {
                const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
                if (decodedToken.email !== email) {
                    return res.status(401).json({ success: false, error: 'بريد غير متطابق.' });
                }
            } else {
                return res.status(500).json({ success: false, error: 'خدمة جوجل غير مفعلة.' });
            }
        }
    } catch (error) {
        return res.status(401).json({ success: false, error: 'فشل التحقق.' });
    }

    const { user, accessToken, refreshToken } = await authService.googleSync({ name, email, googleUid, avatar });
    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        user,
        phoneRequired: !user?.phone
    });
});

exports.logout = (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('csrfToken');
    res.status(200).json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
};

exports.refreshToken = catchAsync(async (req, res, next) => {
    const tokenFromCookie = req.cookies?.refreshToken;
    if (!tokenFromCookie) return res.status(401).json({ success: false, error: 'انتهت الجلسة' });

    const tokens = await authService.refreshToken(tokenFromCookie);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    // [SECURITY ROTATION] Return new access token in body for localStorage sync
    res.status(200).json({ success: true, token: tokens.accessToken, accessToken: tokens.accessToken });
});

