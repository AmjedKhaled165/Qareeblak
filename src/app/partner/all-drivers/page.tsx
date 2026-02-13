"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    MapPin,
    Search,
    UserPlus,
    Trash2,
    X,
    Loader2,
    Check,
    Settings,
    User
} from "lucide-react";
import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";
import ConfirmModal from "@/components/ui/confirm-modal";

export default function AllDriversPage() {
    const router = useRouter();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

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

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const [newDriver, setNewDriver] = useState({
        name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        role: 'courier',
        supervisorId: ''
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setIsOwner(user.role === 'owner');
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const driversData = await apiCall('/halan/users?role=courier');
            if (driversData.success) {
                setDrivers(driversData.data);
            }

            // If owner, fetch managers for assignment
            const storedUser = localStorage.getItem('halan_user');
            if (storedUser && JSON.parse(storedUser).role === 'owner') {
                const allUsers = await apiCall('/halan/users');
                if (allUsers.success) {
                    setManagers(allUsers.data.filter((u: any) => u.role === 'supervisor'));
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredDrivers = drivers.filter(d => {
        // Search filter
        const matchesSearch = (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.username || '').toLowerCase().includes(search.toLowerCase());

        // If supervisor (not owner), only show available drivers
        if (!isOwner && d.isAvailable === false) {
            return false;
        }

        return matchesSearch;
    });

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const data = await apiCall('/halan/auth/register', {
                method: 'POST',
                body: JSON.stringify(newDriver)
            });
            if (data.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم بنجاح',
                    message: 'تم إضافة المندوب بنجاح',
                    type: 'success'
                });
                setShowAddModal(false);
                setNewDriver({
                    name: '',
                    username: '',
                    email: '',
                    phone: '',
                    password: '',
                    role: 'courier',
                    supervisorId: ''
                });
                fetchData();
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: data.error || 'فشل إضافة المندوب',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Add driver error:', error);
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

    const handleDeleteDriver = async (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'حذف المندوب',
            message: 'هل أنت متأكد من حذف هذا المندوب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
            onConfirm: () => executeDeleteDriver(id)
        });
    };

    const executeDeleteDriver = async (id: number) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsActionLoading(true);
        try {
            const data = await apiCall(`/halan/users/${id}`, { method: 'DELETE' });
            if (data.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم بنجاح',
                    message: 'تم الحذف بنجاح',
                    type: 'success',
                    onCloseAction: () => fetchData()
                });
            }
        } catch (error) {
            console.error('Delete error:', error);
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: 'حدث خطأ غير متوقع أثناء الحذف',
                type: 'error'
            });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAssign = async (userId: number, supervisorId: number, action: 'add' | 'remove') => {
        try {
            const data = await apiCall('/halan/users/assign', {
                method: 'POST',
                body: JSON.stringify({ userId, supervisorId, action })
            });
            if (data.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Assign error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2" title="العودة">
                        <ArrowRight className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">كل المناديب</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{drivers.length} مندوب</p>
                    </div>
                </div>
                {isOwner && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        إضافة مندوب
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="p-4 bg-white dark:bg-slate-900 shadow-sm mb-4">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="بحث عن مندوب..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-4 pb-20">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredDrivers.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">لا يوجد نتائج</div>
                ) : (
                    filteredDrivers.map((driver) => (
                        <div key={driver.id} className="group overflow-hidden rounded-2xl bg-white dark:bg-[#111827] shadow-sm border border-slate-100 dark:border-white/5 transition-all hover:shadow-md">
                            <div
                                onClick={() => router.push(`/partner/driver-details/${driver.id}`)}
                                className="p-4 flex items-center justify-between cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <img
                                            src={driver.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=random`}
                                            alt={driver.name}
                                            className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700"
                                        />
                                        <div className={`
                                        absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800
                                        ${driver.isAvailable ? 'bg-green-500' : 'bg-slate-400'}
                                    `} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white">{driver.name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">@{driver.username}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                    {/* Availability Toggle */}
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={Boolean(driver.isAvailable)}
                                            title="تبديل توفر المندوب"
                                            onChange={async () => {
                                                const newStatus = !driver.isAvailable;
                                                setDrivers(prev => prev.map(d =>
                                                    d.id === driver.id ? { ...d, isAvailable: newStatus } : d
                                                ));
                                                try {
                                                    await apiCall(`/halan/users/${driver.id}/availability`, {
                                                        method: 'PATCH',
                                                        body: JSON.stringify({ isAvailable: newStatus })
                                                    });
                                                } catch (error) {
                                                    setDrivers(prev => prev.map(d =>
                                                        d.id === driver.id ? { ...d, isAvailable: !newStatus } : d
                                                    ));
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                    </label>

                                    <button
                                        onClick={() => router.push(`/partner/tracking/${driver.id}?name=${encodeURIComponent(driver.name)}&username=${driver.username}`)}
                                        title="تتبع الموقع"
                                        className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                        <MapPin className="w-5 h-5" />
                                    </button>

                                    {isOwner && (
                                        <button
                                            onClick={() => handleDeleteDriver(driver.id)}
                                            title="حذف المندوب"
                                            className="w-10 h-10 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Owner Assignment Controls - Multi-Manager Checkboxes */}
                            {isOwner && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-slate-500 font-medium text-xs block mb-2">التعيين لمسؤولين:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {managers.map(m => {
                                            const isAssigned = (driver.supervisorIds || []).includes(m.id);
                                            return (
                                                <label
                                                    key={m.id}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-medium ${isAssigned
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={isAssigned}
                                                        onChange={() => handleAssign(driver.id, m.id, isAssigned ? 'remove' : 'add')}
                                                    />
                                                    {m.name}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add Driver Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold">إضافة مندوب جديد</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full" title="إغلاق">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 mr-2">اسم المندوب</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
                                    placeholder="أدخل الاسم"
                                    value={newDriver.name}
                                    onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mr-2">اسم المستخدم (للدخول)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono"
                                    placeholder="مثلاً: ahmed_2024"
                                    value={newDriver.username}
                                    onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mr-2">كلمة المرور</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
                                    placeholder="********"
                                    value={newDriver.password}
                                    onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
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
                                        value={newDriver.phone}
                                        onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mr-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm"
                                        placeholder="user@example.com"
                                        value={newDriver.email}
                                        onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mr-2">تعيين لمسؤول (مشرف)</label>
                                <select
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3"
                                    value={newDriver.supervisorId}
                                    onChange={(e) => setNewDriver({ ...newDriver, supervisorId: e.target.value })}
                                    title="اختر المسؤول"
                                >
                                    <option value="">-- بدون تعيين حالياً --</option>
                                    {managers.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
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
                confirmText="حذف نهائي"
                cancelText="إلغاء"
                isDestructive={true}
            />
        </div>
    );
}
