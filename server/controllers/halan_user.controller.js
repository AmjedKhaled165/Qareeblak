const userRepo = require('../repositories/halan_user.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const bcrypt = require('bcryptjs');

exports.assignCourier = catchAsync(async (req, res) => {
    const { userId, supervisorId, action } = req.body;
    const { role } = req.user;

    if (role !== 'owner' && role !== 'partner_owner') throw new AppError('Unauthorized', 403);

    if (action === 'add') await userRepo.assignCourier(userId, supervisorId);
    else await userRepo.unassignCourier(userId, supervisorId);

    res.json({ success: true, message: 'تم التحديث بنجاح' });
});

exports.getUsers = catchAsync(async (req, res) => {
    const { role, supervisorId } = req.query;
    const currentUserId = req.user.userId || req.user.id;
    const currentUserRole = req.user.role;

    const rows = await userRepo.getUsers({ role, supervisorId, currentUserId, currentUserRole });
    const users = rows.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.user_type.replace('partner_', ''),
        isAvailable: user.is_available,
        supervisorIds: user.supervisor_ids || [],
        createdAt: user.created_at
    }));

    res.json({ success: true, data: users });
});

exports.getUser = catchAsync(async (req, res) => {
    const user = await userRepo.getById(req.params.id);
    if (!user) throw new AppError('المستخدم غير موجود', 404);
    res.json({
        success: true,
        data: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            role: user.user_type.replace('partner_', ''),
            isAvailable: user.is_available
        }
    });
});

exports.updateAvailability = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { isAvailable } = req.body;
    await userRepo.updateAvailability(id, isAvailable);

    const io = req.app.get('io');
    if (io) {
        io.emit('driver-status-changed', { driverId: id, status: isAvailable ? 'online' : 'offline' });
    }
    res.json({ success: true, message: 'تم تحديث الحالة' });
});

exports.updateProfile = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name_ar, username, email, phone, avatar, oldPassword, newPassword } = req.body;

    const currentUser = await userRepo.getById(id);
    if (!currentUser) throw new AppError('المستخدم غير موجود', 404);

    const updates = {};
    if (name_ar) updates.name = name_ar;
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    if (newPassword) {
        if (!oldPassword) throw new AppError('يجب إدخال كلمة المرور الحالية', 400);
        const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
        if (!isMatch) throw new AppError('كلمة المرور الحالية غير صحيحة', 400);
        updates.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) return res.json({ success: true, message: 'لا توجد تغييرات' });

    const updated = await userRepo.updateProfile(id, updates);
    res.json({
        success: true,
        message: 'تم تحديث البيانات بنجاح',
        data: {
            ...updated,
            name_ar: updated.name,
            role: updated.user_type.replace('partner_', '')
        }
    });
});

exports.deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== 'owner' && role !== 'partner_owner') throw new AppError('Unauthorized', 403);

    const success = await userRepo.deleteUser(id);
    if (!success) throw new AppError('المستخدم غير موجود', 404);

    const io = req.app.get('io');
    if (io) {
        io.emit('user-deleted', { id, role: 'partner' });
        io.emit('driver-status-changed', { driverId: id, status: 'offline' });
    }
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
});
