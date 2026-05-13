"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Phone, Search, Shield, MapPin } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface User {
    id: number;
    name: string;
    username: string;
    phone: string;
    role: string;
    isAvailable: boolean;
    supervisorIds?: number[];
    // supervisorId?: number; // Deprecated but kept if needed for fallback
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ManagerDetailsPage({ params }: PageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [managerId, setManagerId] = useState<string>('');
    const [manager, setManager] = useState<User | null>(null);
    const [drivers, setDrivers] = useState<User[]>([]); // All drivers
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    // Unwrap params
    useEffect(() => {
        params.then(p => setManagerId(p.id));
    }, [params]);

    useEffect(() => {
        if (managerId) {
            fetchData();
        }
    }, [managerId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch data
            const usersData = await apiCall('/halan/users');

            if (usersData.success) {
                const allUsers = usersData.data;
                const foundManager = allUsers.find((u: any) => u.id === parseInt(managerId));
                setManager(foundManager || null);

                // Get all couriers
                const allDrivers = allUsers.filter((u: any) => u.role === 'courier');
                setDrivers(allDrivers);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            toast('حدث خطأ أثناء تحميل البيانات', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleAssignment = async (driver: User, isAssigned: boolean) => {
        setTogglingId(driver.id);
        const action = isAssigned ? 'remove' : 'add';

        try {
            const data = await apiCall(`/halan/users/${driver.id}/supervisor`, {
                method: 'PATCH',
                body: JSON.stringify({
                    managerId: parseInt(managerId),
                    action: action
                })
            });

            if (data.success) {
                // Optimistic update locally
                setDrivers(prev => prev.map(d => {
                    if (d.id === driver.id) {
                        const currentIds = d.supervisorIds || [];
                        const newIds = action === 'add'
                            ? [...currentIds, parseInt(managerId)]
                            : currentIds.filter(id => id !== parseInt(managerId));
                        return { ...d, supervisorIds: newIds };
                    }
                    return d;
                }));
                toast(isAssigned ? 'تم إلغاء تعيين المندوب' : 'تم تعيين المندوب بنجاح', 'success');
            } else {
                toast('فشل تحديث الحالة: ' + (data.error || 'خطأ غير معروف'), 'error');
            }
        } catch (error) {
            console.error('Assignment error:', error);
            toast('حدث خطأ أثناء الاتصال بالسيرفر', 'error');
        } finally {
            setTogglingId(null);
        }
    };

    const filteredDrivers = drivers.filter(d =>
        (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.username || '').toLowerCase().includes(search.toLowerCase())
    );

    const assignedCount = drivers.filter(d => (d.supervisorIds || []).includes(parseInt(managerId))).length;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!manager) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500" dir="rtl">
                مدير غير موجود
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2" title="الرجوع للخلف" aria-label="الرجوع للخلف">
                    <ArrowRight className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">إدارة فريق العمل</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {manager.name} • {assignedCount} مندوب
                    </p>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="بحث عن مندوب..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 rounded-xl py-3 pr-10 pl-4 shadow-sm outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                    />
                </div>

                {/* Drivers List */}
                <div className="space-y-3">
                    {filteredDrivers.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">لا يوجد مناديب</div>
                    ) : (
                        filteredDrivers.map((driver) => {
                            const isAssignedToMe = (driver.supervisorIds || []).includes(parseInt(managerId));
                            const isAssignedToOther = (driver.supervisorIds || []).some(id => id !== parseInt(managerId));
                            const isLoadingToggle = togglingId === driver.id;

                            return (
                                <div
                                    key={driver.id}
                                    className={`
                                        rounded-2xl p-4 shadow-sm border-2 transition-all flex items-center justify-between
                                        ${isAssignedToMe
                                            ? 'bg-violet-50 dark:bg-violet-900/10 border-violet-600 dark:border-violet-500'
                                            : 'bg-white dark:bg-slate-800 border-transparent'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=random`}
                                                alt={driver.name}
                                                className="w-12 h-12 rounded-full"
                                            />
                                            {isAssignedToMe && (
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-600 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                                                    <Shield className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold">{driver.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">@{driver.username}</p>

                                            {isAssignedToOther && (
                                                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    معين لمسؤول آخر
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={isAssignedToMe}
                                                disabled={isLoadingToggle}
                                                onChange={() => handleToggleAssignment(driver, isAssignedToMe)}
                                                aria-label={`تعيين ${driver.name} لهذا المسؤول`}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                                        </label>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
