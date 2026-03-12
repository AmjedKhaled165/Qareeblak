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
    const { name, email, googleUid, avatar, firebaseIdToken, isDevMock } = req.body;

    if (!email || (!firebaseIdToken && !isDevMock)) {
        return res.status(400).json({ success: false, error: 'البيانات غير مكتملة. يلزم وجود ايميل وتوكن مصادقة صالحة من Google.' });
    }

    try {
        // [DEV ONLY FALLBACK]: Allow mock login if keys are missing but ONLY in development
        if (isDevMock && process.env.NODE_ENV !== 'production') {
            logger.warn(`⚠️ [DEV MODE] Accepted Mock Google Auth Token for ${email}`);
        } else {
            const admin = require('firebase-admin');

            // Initialize Firebase Admin if not already done
            if (!admin.apps.length) {
                if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                    try {
                        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
                    } catch (parseError) {
                        logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', parseError);
                        return res.status(500).json({ success: false, error: 'يوجد خطأ في إعدادات Firebase JSON على خادم الإنتاج.' });
                    }
                } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
                    try {
                        admin.initializeApp({
                            credential: admin.credential.cert({
                                projectId: process.env.FIREBASE_PROJECT_ID,
                                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                                // Handle literal \n strings that might come from .env parsing
                                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                            })
                        });
                    } catch (initError) {
                        logger.error('Failed to initialize Firebase with individual ENV keys', initError);
                        return res.status(500).json({ success: false, error: 'فشل تهيئة Firebase باستخدام المفاتيح المتفرقة في الخادم.' });
                    }
                } else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID) {
                    admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID });
                } else {
                    logger.error('SECURITY BLOCK: Firebase Admin not configured. Missing PROJECT_ID or SERVICE_ACCOUNT.');
                    return res.status(503).json({ success: false, error: 'إعدادات Firebase غير موجودة في (السيرفر Backend .env). الرجاء إضافة FIREBASE_PROJECT_ID.' });
                }
            }

            // MANDATORY: Always verify the Firebase ID token — No exceptions
            const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);

            // SECURITY: Ensure the verified token belongs to the claimed email
            if (decodedToken.email !== email) {
                logger.warn(`[SECURITY ALERT] Firebase Token email mismatch. Token: ${decodedToken.email}, Claimed: ${email}, IP: ${req.ip}`);
                return res.status(401).json({ success: false, error: 'غير مصرح لك. بريد إلكتروني غير متطابق بين جوجل والسيرفر.' });
            }
        }
    } catch (error) {
        logger.error(`[SECURITY] Firebase token verification failed: ${error.message} | IP: ${req.ip}`);
        let message = 'فشل التحقق من هوية جوجل. ';
        if (error.message.includes('Credential must be provided') || error.message.includes('credential')) {
            message += 'السيرفر يفتقر إلى صلاحيات Firebase (Service Account). الرجاء التواصل مع الدعم الفني لدعم السيرفر بالمفاتيح.';
        } else if (error.code === 'auth/id-token-expired') {
            message += 'جلستك في جوجل انتهت. يرجى إعادة تسجيل الدخول.';
        } else {
            message += 'خطأ في التوكن أو السيرفر. (السبب: ' + error.message + ')';
        }
        return res.status(401).json({ success: false, error: message });
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

