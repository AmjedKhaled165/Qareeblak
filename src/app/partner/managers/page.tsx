"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Users, Phone, MapPin, UserPlus, Trash2, X, Loader2, Check } from "lucide-react";
import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function ManagersPage() {
    const router = useRouter();
    const [managers, setManagers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [managerCounts, setManagerCounts] = useState<Record<number, number>>({});

    // Status Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onCloseAction?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const [newManager, setNewManager] = useState({
        name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        role: 'supervisor'
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setIsOwner(user.role === 'owner');
        }
        fetchManagersAndDrivers();
    }, []);

    const fetchManagersAndDrivers = async () => {
        setIsLoading(true);
        try {
            // Fetch all users to get both managers and drivers
            const data = await apiCall('/halan/users');

            if (data.success) {
                const allUsers = data.data;
                const supervisors = allUsers.filter((u: any) => u.role === 'supervisor');
                const couriers = allUsers.filter((u: any) => u.role === 'courier');

                // Calculate counts
                const counts: Record<number, number> = {};
                supervisors.forEach((s: any) => {
                    const assigned = couriers.filter((c: any) =>
                        (c.supervisorIds || []).map((id: any) => Number(id)).includes(Number(s.id))
                    );
                    counts[s.id] = assigned.length;
                    s.assignedNames = assigned.map((c: any) => c.name);
                });

                setManagers(supervisors);
                setManagerCounts(counts);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredManagers = managers.filter(m =>
        (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.username || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleAddManager = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const data = await apiCall('/halan/auth/register', {
                method: 'POST',
                body: JSON.stringify(newManager)
            });
            if (data.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم بنجاح',
                    message: 'تم إضافة المسؤول بنجاح',
                    type: 'success'
                });
                setShowAddModal(false);
                setNewManager({
                    name: '',
                    username: '',
                    email: '',
                    phone: '',
                    password: '',
                    role: 'supervisor'
                });
                fetchManagersAndDrivers();
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: data.error || 'فشل إضافة المسؤول',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Add manager error:', error);
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: 'حدث خطأ غير متوقع',
                type: 'error'
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteManager = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'تأكيد الحذف',
            message: 'هل أنت متأكد من حذف هذا المسؤول نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const data = await apiCall(`/halan/users/${id}`, { method: 'DELETE' });
                    if (data.success) {
                        setModalState({
                            isOpen: true,
                            title: 'تم بنجاح',
                            message: 'تم الحذف بنجاح',
                            type: 'success',
                            onCloseAction: () => fetchManagersAndDrivers()
                        });
                    } else {
                        // Handle handled errors (400, etc)
                        setModalState({
                            isOpen: true,
                            title: 'خطأ',
                            message: data.error || 'فشل عملية الحذف',
                            type: 'error'
                        });
                    }
                } catch (error: any) {
                    console.error('Delete error:', error);
                    setModalState({
                        isOpen: true,
                        title: 'خطأ',
                        message: error.message || 'حدث خطأ غير متوقع أثناء الحذف',
                        type: 'error'
                    });
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2" title="العودة" aria-label="العودة">
                        <ArrowRight className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">كل المسؤولين</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{managers.length} مسؤول</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {isOwner && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                        >
                            <UserPlus className="w-4 h-4" />
                            إضافة مسؤول
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="p-4 bg-white dark:bg-slate-900 shadow-sm mb-4">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="بحث عن مسؤول..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-3 pb-20">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredManagers.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">لا يوجد مسؤولين</div>
                ) : (
                    filteredManagers.map((manager) => (
                        <div
                            key={manager.id}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div onClick={() => router.push(`/partner/managers/${manager.id}`)} className="flex items-center gap-3 cursor-pointer flex-1">
                                    <img
                                        src={manager.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.name)}&background=random`}
                                        alt={manager.name}
                                        className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700"
                                    />
                                    <div>
                                        <p className="font-bold">{manager.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">@{manager.username}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="px-3 py-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-full text-[10px] font-bold">
                                        {(managerCounts[manager.id] || 0) === 0
                                            ? 'بدون مناديب'
                                            : `${managerCounts[manager.id]} مناديب`
                                        }
                                    </span>
                                    <span className="text-[10px] text-slate-400 max-w-[120px] text-left truncate">
                                        {manager.assignedNames?.join(', ')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-slate-500 border-t pt-3 dark:border-slate-700">
                                {manager.phone && (
                                    <a href={`tel:${manager.phone}`} className="flex items-center gap-1 hover:text-violet-600">
                                        <Phone className="w-4 h-4" />
                                        {manager.phone}
                                    </a>
                                )}
                                <div className="flex-1" />
                                {isOwner && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteManager(manager.id);
                                        }}
                                        title="حذف المسؤول"
                                        aria-label="حذف المسؤول"
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Manager Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold">إضافة مسؤول جديد</h2>
                            <button onClick={() => setShowAddModal(false)} title="إغلاق" aria-label="إغلاق" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddManager} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 mr-2">اسم المسؤول</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
                                    placeholder="أدخل الاسم"
                                    value={newManager.name}
                                    onChange={(e) => setNewManager({ ...newManager, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mr-2">اسم المستخدم (للدخول)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono"
                                    placeholder="مثلاً: manager_1"
                                    value={newManager.username}
                                    onChange={(e) => setNewManager({ ...newManager, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mr-2">كلمة المرور</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
                                    placeholder="********"
                                    value={newManager.password}
                                    onChange={(e) => setNewManager({ ...newManager, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 mr-2">رقم الهاتف</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono text-sm"
                                        placeholder="01xxxxxxxxx"
                                        value={newManager.phone}
                                        onChange={(e) => setNewManager({ ...newManager, phone: e.target.value })}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mr-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm"
                                        placeholder="user@example.com"
                                        value={newManager.email}
                                        onChange={(e) => setNewManager({ ...newManager, email: e.target.value })}
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isActionLoading}
                                    className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-all"
                                >
                                    {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    تأكيد الإضافة
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 bg-slate-100 dark:bg-slate-800 py-4 rounded-2xl font-bold"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <StatusModal
                isOpen={modalState.isOpen}
                onClose={() => {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                    if (modalState.onCloseAction) {
                        modalState.onCloseAction();
                    }
                }}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="حذف"
                cancelText="إلغاء"
                isDestructive={true}
            />
        </div>
    );
}
