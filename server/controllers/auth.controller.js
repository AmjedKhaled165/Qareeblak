const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.register = catchAsync(async (req, res, next) => {
    // Validation is handled via middleware route
    const { user, token } = await authService.registerUser(req.body);

    logger.info(`User registered successfully: ${user.email}`);
    res.status(201).json({
        message: 'تم التسجيل بنجاح',
        user,
        token
    });
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const { user, token } = await authService.loginUser(email, password);

    logger.info(`User logged in: ${user.email}`);
    res.status(200).json({
        message: 'تم تسجيل الدخول بنجاح',
        user,
        token
    });
});

exports.guestLogin = catchAsync(async (req, res, next) => {
    const { user, token } = await authService.guestLogin();

    logger.info(`Guest logged in: ${user.email}`);
    res.status(200).json({
        message: 'تم الدخول كزائر بنجاح',
        user,
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
