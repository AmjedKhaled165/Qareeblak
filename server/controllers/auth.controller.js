const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.register = catchAsync(async (req, res, next) => {
    // Validation is handled via middleware route
    const { user, accessToken, refreshToken, token } = await authService.registerUser(req.body);

    logger.info(`User registered successfully: ${user.email}`);
    res.status(201).json({
        message: 'تم التسجيل بنجاح',
        user,
        accessToken,
        refreshToken,
        token
    });
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken, token } = await authService.loginUser(email, password);

    logger.info(`User logged in: ${user.email}`);
    res.status(200).json({
        message: 'تم تسجيل الدخول بنجاح',
        user,
        accessToken,
        refreshToken,
        token // For backwards compatibility
    });
});

exports.guestLogin = catchAsync(async (req, res, next) => {
    const { user, accessToken, refreshToken, token } = await authService.guestLogin();

    logger.info(`Guest logged in: ${user.email}`);
    res.status(200).json({
        message: 'تم الدخول كزائر بنجاح',
        user,
        accessToken,
        refreshToken,
        token
    });
});

exports.getMe = catchAsync(async (req, res, next) => {
    // req.user is set by verifyToken middleware
    res.status(200).json(req.user);
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
    await authService.approveRequest(req.params.id);

    logger.info(`Provider request approved: ${req.params.id}`);
    res.status(200).json({ message: 'تم قبول الطلب بنجاح' });
});

exports.rejectRequest = catchAsync(async (req, res, next) => {
    await authService.rejectRequest(req.params.id);

    logger.info(`Provider request rejected: ${req.params.id}`);
    res.status(200).json({ message: 'تم رفض الطلب' });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
    const updatedUser = await authService.updateProfile(req.user.id, req.body);

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

/**
 * POST /auth/google-sync
 * Idempotent upsert: creates a new customer account for a Google user,
 * or fetches their existing account if already registered with the same email.
 * Returns a real JWT so real-time features and bookings work correctly.
 */
exports.googleSync = catchAsync(async (req, res, next) => {
    // SECURITY: Verify the Firebase token to prove identity before any account access
    const { name, email, googleUid, avatar, firebaseIdToken } = req.body;

    if (!email || !firebaseIdToken) {
        return res.status(400).json({ success: false, error: 'البيانات غير مكتملة. يلزم وجود ايميل وتوكن مصادقة صالحة من Google.' });
    }

    try {
        const admin = require('firebase-admin');

        // Initialize Firebase Admin if not already done
        if (!admin.apps.length) {
            if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                // Production: Use full service account JSON (most secure)
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            } else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
                // Fallback: Use project ID with Application Default Credentials
                admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
            } else {
                // BLOCKED: Cannot verify without Firebase configuration — reject in production
                logger.error('SECURITY BLOCK: Firebase Admin not configured. Rejecting Google Sync request.');
                return res.status(503).json({ success: false, error: 'خدمة المصادقة عبر Google غير متاحة حالياً. يرجى التواصل مع الإدارة.' });
            }
        }

        // MANDATORY: Always verify the Firebase ID token — No exceptions
        const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);

        // SECURITY: Ensure the verified token belongs to the claimed email
        if (decodedToken.email !== email) {
            logger.warn(`[SECURITY ALERT] Firebase Token email mismatch. Token: ${decodedToken.email}, Claimed: ${email}, IP: ${req.ip}`);
            return res.status(401).json({ success: false, error: 'غير مصرح لك. بريد إلكتروني غير متطابق.' });
        }

    } catch (error) {
        // CRITICAL: Hard reject on ANY verification failure — this was the original vulnerability
        logger.error(`[SECURITY] Firebase token verification failed: ${error.message} | IP: ${req.ip}`);
        return res.status(401).json({ success: false, error: 'فشل التحقق من الهوية. يرجى تسجيل الدخول مجدداً عبر Google.' });
    }

    const { user, accessToken, refreshToken, token } = await authService.googleSync({ name, email, googleUid, avatar });

    logger.info(`Google sync success for: ${email}`);
    res.status(200).json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        user,
        token
    });
});

exports.refreshToken = catchAsync(async (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    const tokens = await authService.refreshToken(refreshToken);

    logger.info(`Token refreshed successfully`);
    res.status(200).json({
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        token: tokens.accessToken // For backwards compatibility
    });
});

