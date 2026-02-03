"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun, LogOut, User, Bell, Camera, Eye, EyeOff, Save, X, Edit3, Fingerprint, Phone, Mail, Shield, Check } from "lucide-react";
import { usersApi } from "@/lib/api";

export default function SettingsPage() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [user, setUser] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form fields
    const [newName, setNewName] = useState("");
    const [newUsername, setNewUsername] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setAvatar(userData.avatar || null);

        // Initialize form fields
        setNewName(userData.name_ar || userData.name || "");
        setNewUsername(userData.username || "");
        setNewEmail(userData.email || "");
        setNewPhone(userData.phone || "");
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('halan_token');
        localStorage.removeItem('halan_user');
        router.push('/login/partner');
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'owner': return 'المالك';
            case 'supervisor': return 'مسؤول';
            case 'courier': return 'مندوب';
            default: return role;
        }
    };

    const handleImagePick = () => {
        if (!isEditing) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;

        // Validation
        if (newPassword && !oldPassword) {
            setMessage({ type: 'error', text: 'يجب إدخال كلمة المرور الحالية أولاً لتتمكن من تغيير كلمة المرور' });
            return;
        }
        if (newPassword && newPassword.length < 6) {
            setMessage({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'كلمات المرور الجديدة غير متطابقة' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const updateData: any = {};
            if (newName.trim() && newName !== user.name_ar) updateData.name_ar = newName.trim();
            if (newUsername.trim() && newUsername !== user.username) updateData.username = newUsername.trim();
            if (newEmail.trim() && newEmail !== user.email) updateData.email = newEmail.trim();
            if (newPhone.trim() && newPhone !== user.phone) updateData.phone = newPhone.trim();
            if (avatar && avatar !== user.avatar) updateData.avatar = avatar;
            if (oldPassword && newPassword) {
                updateData.oldPassword = oldPassword;
                updateData.newPassword = newPassword;
            }

            if (Object.keys(updateData).length === 0) {
                setMessage({ type: 'error', text: 'لم يتم إجراء أي تغييرات للحفظ' });
                setIsSaving(false);
                return;
            }

            const result = await usersApi.updateUser(user.id, updateData);

            if (result.success) {
                const updatedUser = {
                    ...user,
                    name_ar: result.data?.name_ar || updateData.name_ar || user.name_ar,
                    username: result.data?.username || updateData.username || user.username,
                    email: result.data?.email || updateData.email || user.email,
                    phone: result.data?.phone || updateData.phone || user.phone,
                    avatar: result.data?.avatar || avatar || user.avatar,
                };
                localStorage.setItem('halan_user', JSON.stringify(updatedUser));
                setUser(updatedUser);

                setMessage({ type: 'success', text: 'تم تحديث بيانات ملفك الشخصي بنجاح! ✨' });
                setIsEditing(false);
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                setMessage({ type: 'error', text: result.error || 'فشل التحديث، يرجى المحاولة مرة أخرى' });
            }
        } catch (error: any) {
            console.error('Save error:', error);
            setMessage({ type: 'error', text: error.message || 'حدث خطأ غير متوقع' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setNewName(user.name_ar || user.name || "");
        setNewUsername(user.username || "");
        setNewEmail(user.email || "");
        setNewPhone(user.phone || "");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setAvatar(user?.avatar || null);
        setMessage(null);
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
            {/* Elegant Header */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 flex items-center justify-between shadow-sm sticky top-0 z-30 transition-all border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95" title="العودة">
                        <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                    <h1 className="text-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">الإعدادات</h1>
                </div>
                {isEditing && (
                    <div className="flex gap-2">
                        <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="إلغاء">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-6 max-w-2xl mx-auto pb-10">
                {/* Status Alerts */}
                {message && (
                    <div className={`p-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2 duration-500 ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30'
                        : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30'
                        }`}>
                        {message.type === 'success' ? <Check className="w-5 h-5" /> : <Shield className="w-5 h-5 text-red-400" />}
                        {message.text}
                    </div>
                )}

                {/* Profile Identity Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-all">
                    {/* Background Decorative Element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full -mr-10 -mt-10" />

                    <div className="flex flex-col items-center mb-10 relative">
                        <div className="relative">
                            <button
                                onClick={handleImagePick}
                                disabled={!isEditing}
                                className={`relative group rounded-full p-1.5 border-4 transition-all duration-500 ${isEditing
                                    ? 'border-violet-500 cursor-pointer scale-105 rotate-2'
                                    : 'border-slate-100 dark:border-slate-800 scroll-0 pointer-events-none'
                                    }`}
                            >
                                {avatar ? (
                                    <img src={avatar} alt="Profile" className="w-32 h-32 rounded-full object-cover shadow-2xl" />
                                ) : (
                                    <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                        <User className="w-16 h-16 text-slate-300" />
                                    </div>
                                )}
                                {isEditing && (
                                    <div className="absolute inset-0 bg-violet-600/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                        <Camera className="w-10 h-10 text-white drop-shadow-lg" />
                                    </div>
                                )}
                            </button>
                            {isEditing && (
                                <div className="absolute -bottom-1 -left-1 w-11 h-11 bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-950 rounded-full flex items-center justify-center shadow-xl animate-bounce">
                                    <Camera className="w-5 h-5 text-violet-600" />
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} title="تحميل صورة الملف الشخصي" />
                        </div>
                        <div className="text-center mt-6">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight">{user.name_ar || user.name}</h2>
                            <p className="text-slate-400 font-bold text-sm">@{user.username}</p>
                            <div className="mt-4 px-5 py-1.5 bg-violet-600 text-white rounded-full text-xs font-black shadow-lg shadow-violet-500/30 uppercase tracking-widest inline-block">
                                {getRoleLabel(user.role)}
                            </div>
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="absolute top-6 left-6">
                            <button
                                onClick={() => setIsEditing(true)}
                                title="تعديل البيانات"
                                className="w-12 h-12 bg-slate-50 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-400 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-90"
                            >
                                <Edit3 className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Data Rows */}
                    <div className="space-y-6">
                        {/* Row 1: Display Name */}
                        <div className="group">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block mr-1 flex items-center gap-2">
                                <User className="w-3 h-3" /> الاسم المعروض
                            </label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                value={isEditing ? newName : (user.name_ar || user.name)}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={user.name_ar || user.name}
                                className={`w-full px-6 py-4 rounded-[1.25rem] font-bold transition-all outline-none border-2 ${isEditing
                                    ? 'bg-white dark:bg-slate-800 border-violet-100 dark:border-slate-700 focus:border-violet-500 focus:shadow-xl focus:shadow-violet-500/10'
                                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'
                                    }`}
                            />
                        </div>

                        {/* Row 2: Username */}
                        <div className="group">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block mr-1 flex items-center gap-2">
                                <Fingerprint className="w-3 h-3" /> اسم المستخدم (Login)
                            </label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                value={isEditing ? newUsername : user.username}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder={user.username}
                                className={`w-full px-6 py-4 rounded-[1.25rem] font-bold transition-all outline-none border-2 text-left ${isEditing
                                    ? 'bg-white dark:bg-slate-800 border-violet-100 dark:border-slate-700 focus:border-violet-500 focus:shadow-xl focus:shadow-violet-500/10'
                                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'
                                    }`}
                                dir="ltr"
                            />
                        </div>

                        {/* Row 3: Grid Contacts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block mr-1 flex items-center gap-2">
                                    <Mail className="w-3 h-3" /> البريد الإلكتروني
                                </label>
                                <input
                                    type="email"
                                    disabled={!isEditing}
                                    value={isEditing ? newEmail : user.email}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder={user.email || "example@email.com"}
                                    className={`w-full px-6 py-4 rounded-[1.25rem] font-bold transition-all outline-none border-2 text-left ${isEditing
                                        ? 'bg-white dark:bg-slate-800 border-violet-100 dark:border-slate-700 focus:border-violet-500 focus:shadow-xl focus:shadow-violet-500/10'
                                        : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'
                                        }`}
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block mr-1 flex items-center gap-2">
                                    <Phone className="w-3 h-3" /> رقم الهاتف
                                </label>
                                <input
                                    type="tel"
                                    disabled={!isEditing}
                                    value={isEditing ? newPhone : user.phone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    placeholder={user.phone || "01xxxxxxxxx"}
                                    className={`w-full px-6 py-4 rounded-[1.25rem] font-bold transition-all outline-none border-2 text-left ${isEditing
                                        ? 'bg-white dark:bg-slate-800 border-violet-100 dark:border-slate-700 focus:border-violet-500 focus:shadow-xl focus:shadow-violet-500/10'
                                        : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'
                                        }`}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Password Section - Expanded Only When Editing */}
                        {isEditing && (
                            <div className="mt-10 pt-10 border-t-2 border-slate-50 dark:border-slate-800 space-y-6">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                    تغيير كلمة المرور الشخصية
                                </h3>

                                <div className="space-y-4">
                                    {/* Old Password Input */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">كلمة المرور الحالية (ضروري لإتمام الحفظ)</label>
                                        <div className="relative">
                                            <input
                                                type={showOldPassword ? "text" : "password"}
                                                value={oldPassword}
                                                name={`old-pwd-${Math.random()}`} // Random name to trick autofill
                                                onChange={(e) => setOldPassword(e.target.value)}
                                                placeholder="أدخل الرمز الحالي للتأكيد"
                                                className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-orange-400 rounded-3xl font-bold outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                                dir="ltr"
                                                autoComplete="off"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOldPassword(!showOldPassword)}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-2xl transition-all"
                                            >
                                                {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* New Password */}
                                        <div className="relative">
                                            <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">الرمز الجديد</label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? "text" : "password"}
                                                    value={newPassword}
                                                    name={`new-pwd-${Math.random()}`}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="6 أحرف على الأقل"
                                                    className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-violet-500 rounded-3xl font-bold outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                                    dir="ltr"
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-2xl transition-all"
                                                >
                                                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="relative">
                                            <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">تأكيد الرمز</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="أعد كتابة الرمز"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-violet-500 rounded-3xl font-bold outline-none transition-all text-left placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                                dir="ltr"
                                                autoComplete="new-password"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {isEditing && (
                            <div className="flex gap-4 pt-10">
                                <button
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                    className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 rounded-3xl font-black transition-all active:scale-95"
                                >
                                    إلغاء التعديلات
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-[2] py-5 bg-violet-600 text-white rounded-3xl font-black shadow-2xl shadow-violet-600/30 hover:bg-violet-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-6 h-6" />
                                            حفظ التغييرات الآن
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sub-Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Theme Toggle */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                                <Sun className="w-6 h-6 text-orange-500" />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 dark:text-white">المظهر الداكن</h4>
                                <p className="text-xs text-slate-400 font-bold">تغيير ستايل التطبيق</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className={`w-16 h-9 rounded-full relative transition-all duration-500 ${theme === 'dark' ? 'bg-violet-600' : 'bg-slate-200 shadow-inner'
                                }`}
                        >
                            <div className={`absolute top-1.5 w-6 h-6 bg-white rounded-full shadow-xl transition-all duration-500 ${theme === 'dark' ? 'left-1.5' : 'left-8.5'
                                } flex items-center justify-center`}>
                                {theme === 'dark' ? <Moon className="w-3 h-3 text-violet-600" /> : <Sun className="w-3 h-3 text-orange-400" />}
                            </div>
                        </button>
                    </div>

                    {/* Security Actions */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 transition-all flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <button
                                onClick={handleLogout}
                                className="w-full text-right group"
                            >
                                <h4 className="font-black text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform">تسجيل الخروج</h4>
                                <p className="text-xs text-slate-400 font-bold">إنهاء الجلسة الحالية أمنياً</p>
                            </button>
                        </div>
                        <LogOut className="w-5 h-5 text-slate-300" />
                    </div>
                </div>
            </div>
        </div>
    );
}
