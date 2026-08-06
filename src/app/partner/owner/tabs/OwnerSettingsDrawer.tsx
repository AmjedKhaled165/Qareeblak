"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, LogOut, User, Camera, Eye, EyeOff, Save, X, Edit3, Fingerprint, Phone, Mail, Shield, Check } from "lucide-react";
import { usersApi } from "@/lib/api";

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function OwnerSettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [user, setUser] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
        if (!isOpen) return;
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) return;
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setAvatar(userData.avatar || null);
        setNewName(userData.name_ar || userData.name || "");
        setNewUsername(userData.username || "");
        setNewEmail(userData.email || "");
        setNewPhone(userData.phone || "");
    }, [isOpen]);

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

    const handleImagePick = () => { if (!isEditing) return; fileInputRef.current?.click(); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { const reader = new FileReader(); reader.onloadend = () => setAvatar(reader.result as string); reader.readAsDataURL(file); }
    };

    const handleSave = async () => {
        if (!user?.id) return;
        if (newPassword && !oldPassword) { setMessage({ type: 'error', text: 'يجب إدخال كلمة المرور الحالية أولاً' }); return; }
        if (newPassword && newPassword.length < 6) { setMessage({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' }); return; }
        if (newPassword && newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'كلمات المرور الجديدة غير متطابقة' }); return; }

        setIsSaving(true); setMessage(null);
        try {
            const updateData: any = {};
            if (newName.trim() && newName !== user.name_ar) updateData.name_ar = newName.trim();
            if (newUsername.trim() && newUsername !== user.username) updateData.username = newUsername.trim();
            if (newEmail.trim() && newEmail !== user.email) updateData.email = newEmail.trim();
            if (newPhone.trim() && newPhone !== user.phone) updateData.phone = newPhone.trim();
            if (avatar && avatar !== user.avatar) updateData.avatar = avatar;
            if (oldPassword && newPassword) { updateData.oldPassword = oldPassword; updateData.newPassword = newPassword; }

            if (Object.keys(updateData).length === 0) { setMessage({ type: 'error', text: 'لم يتم إجراء أي تغييرات للحفظ' }); setIsSaving(false); return; }

            const result = await usersApi.updateUser(user.id, updateData);
            if (result.success) {
                const updatedUser = { ...user, name_ar: result.data?.name_ar || updateData.name_ar || user.name_ar, username: result.data?.username || updateData.username || user.username, email: result.data?.email || updateData.email || user.email, phone: result.data?.phone || updateData.phone || user.phone, avatar: result.data?.avatar || avatar || user.avatar };
                localStorage.setItem('halan_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setMessage({ type: 'success', text: 'تم تحديث بيانات ملفك الشخصي بنجاح! ✨' });
                setIsEditing(false); setOldPassword(""); setNewPassword(""); setConfirmPassword("");
            } else {
                setMessage({ type: 'error', text: result.error || 'فشل التحديث، يرجى المحاولة مرة أخرى' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'حدث خطأ غير متوقع' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setNewName(user.name_ar || user.name || ""); setNewUsername(user.username || ""); setNewEmail(user.email || ""); setNewPhone(user.phone || "");
        setOldPassword(""); setNewPassword(""); setConfirmPassword(""); setAvatar(user?.avatar || null); setMessage(null);
    };

    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]" onClick={onClose} />
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-950 z-[201] overflow-y-auto shadow-2xl"
                        dir="rtl"
                    >
                        {/* Header */}
                        <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">الإعدادات</h2>
                            <div className="flex items-center gap-2">
                                {isEditing && <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="إلغاء"><X className="w-5 h-5" /></button>}
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="إغلاق الإعدادات"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="p-4 space-y-6 pb-10">
                            {message && (
                                <div className={`p-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-300'}`}>
                                    {message.type === 'success' ? <Check className="w-5 h-5" /> : <Shield className="w-5 h-5 text-red-400" />}{message.text}
                                </div>
                            )}

                            {/* Profile Card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full -mr-10 -mt-10" />

                                <div className="flex flex-col items-center mb-8 relative">
                                    <div className="relative">
                                        <button onClick={handleImagePick} disabled={!isEditing}
                                            className={`relative group rounded-full p-1 border-4 transition-all ${isEditing ? 'border-violet-500 cursor-pointer' : 'border-slate-100 dark:border-slate-800 pointer-events-none'}`}>
                                            {avatar ? <img src={avatar} alt="Profile" className="w-24 h-24 rounded-full object-cover shadow-lg" /> :
                                                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"><User className="w-12 h-12 text-slate-300" /></div>}
                                            {isEditing && <div className="absolute inset-0 bg-violet-600/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>}
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} title="تحميل صورة" />
                                    </div>
                                    <h2 className="text-xl font-bold mt-3 text-slate-900 dark:text-white">{user.name_ar || user.name}</h2>
                                    <p className="text-slate-400 text-sm">@{user.username}</p>
                                    <div className="mt-2 px-4 py-1 bg-violet-600 text-white rounded-full text-xs font-bold">{getRoleLabel(user.role)}</div>
                                </div>

                                {!isEditing && (
                                    <div className="absolute top-4 left-4">
                                        <button onClick={() => setIsEditing(true)} title="تعديل" className="w-10 h-10 bg-slate-50 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-400 rounded-xl flex items-center justify-center transition-all">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1"><User className="w-3 h-3" />الاسم</label>
                                        <input type="text" disabled={!isEditing} value={isEditing ? newName : (user.name_ar || user.name)} onChange={(e) => setNewName(e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl font-bold transition-all outline-none border ${isEditing ? 'bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-700 focus:border-violet-500' : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'}`} />
                                    </div>
                                    <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1"><Fingerprint className="w-3 h-3" />Username</label>
                                        <input type="text" disabled={!isEditing} value={isEditing ? newUsername : user.username} onChange={(e) => setNewUsername(e.target.value)} dir="ltr"
                                            className={`w-full px-4 py-3 rounded-xl font-bold transition-all outline-none border text-left ${isEditing ? 'bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-700 focus:border-violet-500' : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'}`} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1"><Mail className="w-3 h-3" />البريد</label>
                                            <input type="email" disabled value={user.email || ""} dir="ltr" title="لا يمكن تعديل البريد" className="w-full px-4 py-3 rounded-xl font-bold border-transparent bg-slate-50 dark:bg-slate-800/30 text-slate-400 cursor-not-allowed opacity-70" />
                                        </div>
                                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</label>
                                            <input type="tel" disabled={!isEditing} value={isEditing ? newPhone : user.phone} onChange={(e) => setNewPhone(e.target.value)} dir="ltr"
                                                className={`w-full px-4 py-3 rounded-xl font-bold transition-all outline-none border text-left ${isEditing ? 'bg-white dark:bg-slate-800 border-violet-200 dark:border-slate-700 focus:border-violet-500' : 'bg-slate-50 dark:bg-slate-800/30 border-transparent text-slate-400'}`} />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                            <h3 className="text-sm font-bold flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />تغيير كلمة المرور</h3>
                                            <div className="relative"><input type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="كلمة المرور الحالية" dir="ltr" autoComplete="off"
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-orange-400 rounded-xl font-bold outline-none transition-all" />
                                                <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="relative"><input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="الرمز الجديد" dir="ltr" autoComplete="new-password"
                                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-violet-500 rounded-xl font-bold outline-none transition-all" />
                                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                                                </div>
                                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="تأكيد الرمز" dir="ltr" autoComplete="new-password"
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-violet-500 rounded-xl font-bold outline-none transition-all text-left" />
                                            </div>
                                        </div>
                                    )}

                                    {isEditing && (
                                        <div className="flex gap-3 pt-4">
                                            <button onClick={handleCancel} disabled={isSaving} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-bold transition-all">إلغاء</button>
                                            <button onClick={handleSave} disabled={isSaving}
                                                className="flex-[2] py-3 bg-violet-600 text-white rounded-xl font-bold shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                {isSaving ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-5 h-5" />حفظ</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Settings */}
                            <div className="space-y-3">
                                {/* Theme Toggle */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center"><Sun className="w-5 h-5 text-orange-500" /></div>
                                        <div><h4 className="font-bold text-sm text-slate-900 dark:text-white">المظهر الداكن</h4><p className="text-xs text-slate-400">تغيير ستايل التطبيق</p></div>
                                    </div>
                                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        className={`w-14 h-8 rounded-full relative transition-all duration-500 ${theme === 'dark' ? 'bg-violet-600' : 'bg-slate-200 shadow-inner'}`}>
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${theme === 'dark' ? 'left-1' : 'left-7'} flex items-center justify-center`}>
                                            {theme === 'dark' ? <Moon className="w-3 h-3 text-violet-600" /> : <Sun className="w-3 h-3 text-orange-400" />}
                                        </div>
                                    </button>
                                </div>

                                {/* Logout */}
                                <button onClick={handleLogout}
                                    className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3 hover:border-red-300 dark:hover:border-red-500/30 transition-all group">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center"><Shield className="w-5 h-5 text-red-500" /></div>
                                    <div className="flex-1 text-right"><h4 className="font-bold text-sm text-red-600 dark:text-red-400">تسجيل الخروج</h4><p className="text-xs text-slate-400">إنهاء الجلسة الحالية</p></div>
                                    <LogOut className="w-4 h-4 text-slate-300" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
