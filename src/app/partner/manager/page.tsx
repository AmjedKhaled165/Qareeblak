"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    DollarSign,
    ShoppingCart,
    CheckCircle,
    Users,
    ChevronLeft,
    Settings,
    LogOut,
    RefreshCw,
    ListOrdered,
    Plus,
    MapPin
} from "lucide-react";
import { apiCall } from "@/lib/api";

// Stats Card Component
function StatsCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
    // Determine color classes based on the hex passed (for the 4 standard colors)
    const getColorClasses = (hex: string) => {
        switch (hex.toLowerCase()) {
            case '#10b981': return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', border: 'border-emerald-500/20 dark:border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' };
            case '#3b82f6': return { bg: 'bg-blue-500/10 dark:bg-blue-500/20', border: 'border-blue-500/20 dark:border-blue-500/30', text: 'text-blue-600 dark:text-blue-400' };
            case '#8b5cf6': return { bg: 'bg-violet-500/10 dark:bg-violet-500/20', border: 'border-violet-500/20 dark:border-violet-500/30', text: 'text-violet-600 dark:text-violet-400' };
            case '#f59e0b': return { bg: 'bg-amber-500/10 dark:bg-amber-500/20', border: 'border-amber-500/20 dark:border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' };
            default: return { bg: 'bg-slate-500/10 dark:bg-slate-500/20', border: 'border-slate-500/20 dark:border-slate-500/30', text: 'text-slate-600 dark:text-slate-400' };
        }
    };

    const classes = getColorClasses(color);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 shadow-xl flex-1 min-w-[150px] hover:border-violet-500/30 transition-all hover:scale-[1.02]"
        >
            <div className="flex justify-between items-start mb-3">
                <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${classes.bg} border ${classes.border}`}
                >
                    <Icon className={`w-6 h-6 ${classes.text}`} />
                </div>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        </motion.div>
    );
}

export default function ManagerDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const periods = [
        { key: 'today', label: 'اليوم' },
        { key: 'week', label: 'هذا الأسبوع' },
        { key: 'month', label: 'هذا الشهر' },
    ];

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);

        // Redirect based on role
        if (userData.role === 'owner') {
            router.push('/partner/owner');
            return;
        }
        if (userData.role === 'courier') {
            router.push('/partner/driver');
            return;
        }

        // fetchStats() removed - handled by second useEffect dependent on 'user'
    }, []);

    useEffect(() => {
        if (user && user.role === 'supervisor') {
            setIsLoading(true);
            fetchStats();

            // Auto-refresh every 10 seconds
            const interval = setInterval(fetchStats, 10000);
            return () => clearInterval(interval);
        }
    }, [period, user]);

    const fetchStats = async () => {
        try {
            // Fetch drivers (couriers) - Filter by supervisor if applicable
            let driversEndpoint = '/halan/users?role=courier';
            if (user.role === 'supervisor') {
                driversEndpoint += `&supervisorId=${user.id}`;
            }

            // Console log for debugging
            console.log('Fetching drivers from:', driversEndpoint);


            const driversData = await apiCall(driversEndpoint);

            // Fetch orders for stats
            const ordersData = await apiCall('/halan/orders');

            const orders = ordersData.success ? ordersData.data : [];
            // Only show AVAILABLE drivers to the manager
            const drivers = (driversData.success ? driversData.data : []).filter((d: any) => d.isAvailable);

            // Helper to calculate grand total per order
            const getGrandTotal = (o: any) => {
                const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
                const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                const deliFee = parseFloat(o.delivery_fee?.toString() || '0');
                return itemsTotal + deliFee;
            };

            // Helper to date filter
            const isDateInPeriod = (dateString: string, p: string) => {
                const date = new Date(dateString);
                const start = new Date();
                start.setHours(0, 0, 0, 0); // Start of today (00:00:00)

                if (p === 'today') {
                    return date >= start;
                }
                if (p === 'week') {
                    const day = start.getDay();
                    const diff = (day + 1) % 7; // Start on Saturday
                    start.setDate(start.getDate() - diff);
                    return date >= start;
                }
                if (p === 'month') {
                    start.setDate(1);
                    return date >= start;
                }
                return true;
            };

            // Calculate stats
            const filteredOrders = orders.filter((o: any) => isDateInPeriod(o.created_at, period));
            const deliveredOrders = filteredOrders.filter((o: any) => o.status === 'delivered');
            const totalFees = deliveredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
            const totalSales = deliveredOrders.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);

            // Qareeblak breakdown
            const qareeblakOrders = deliveredOrders.filter((o: any) => o.source === 'qareeblak');
            const qareeblakDeliveryRevenue = qareeblakOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);

            setStats({
                summary: {
                    total_delivery_fees: totalFees,
                    total_sales: totalSales,
                    delivered: deliveredOrders.length,
                    total_drivers: drivers.length,
                    qareeblak_delivery_revenue: qareeblakDeliveryRevenue,
                    qareeblak_count: qareeblakOrders.length
                },
                drivers: drivers.map((d: any) => ({
                    ...d,
                    name_ar: d.name,
                    delivered: filteredOrders.filter((o: any) => o.courier_id === d.id && o.status === 'delivered').length,
                    delivery_fees: filteredOrders
                        .filter((o: any) => o.courier_id === d.id && o.status === 'delivered')
                        .reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0)
                }))
            });

        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('halan_token');
        localStorage.removeItem('halan_user');
        router.push('/login/partner');
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-cairo transition-colors duration-500" dir="rtl">
            {/* Midnight Violet Header */}
            <div
                className="p-8 pt-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1E1B4B] to-[#4338CA] border-b border-white/5"
            >
                {/* Decorative Lights */}
                <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-violet-500/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-20%] right-[-5%] w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-sm">لوحة القيادة</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                                <p className="text-white/80 text-sm">إدارة الفريق والأداء</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onRefresh}
                                title="تحديث البيانات"
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
                            >
                                <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => router.push('/partner/settings')}
                                title="الإعدادات"
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
                            >
                                <Settings className="w-5 h-5 text-white" />
                            </button>
                            <button
                                onClick={handleLogout}
                                title="تسجيل الخروج"
                                className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-all border border-red-500/20"
                            >
                                <LogOut className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    </div>

                    {/* Period Toggles - Themed */}
                    <div className="flex gap-2 p-1.5 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl w-fit mx-auto border border-white/10 dark:border-white/5">
                        {periods.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key as any)}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${period === p.key
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                                    : 'text-white/70 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="w-full p-6 pb-20">

                {isLoading && !stats ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-14 h-14 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-slate-400 animate-pulse">جاري تحميل البيانات...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        {stats?.summary && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                                <StatsCard
                                    title="إجمالي الدخل"
                                    value={`${parseFloat(stats.summary.total_delivery_fees || 0).toFixed(0)} ج.م`}
                                    icon={DollarSign}
                                    color="#10B981"
                                />
                                <StatsCard
                                    title="قريبلك - توصيل"
                                    value={`${parseFloat(stats.summary.qareeblak_delivery_revenue || 0).toFixed(0)} ج.م`}
                                    icon={MapPin}
                                    color="#8B5CF6"
                                />
                                <StatsCard
                                    title="المبيعات"
                                    value={`${parseFloat(stats.summary.total_sales || 0).toFixed(0)} ج.م (${stats.summary.delivered} طلب)`}
                                    icon={ShoppingCart}
                                    color="#3B82F6"
                                />
                                <StatsCard
                                    title="المناديب المتوفرين"
                                    value={stats.summary.total_drivers}
                                    icon={Users}
                                    color="#F59E0B"
                                />
                            </div>
                        )}

                        {/* Section Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="w-1 h-6 bg-violet-500 rounded-full" />
                                أداء المناديب
                            </h2>
                            <button
                                onClick={() => router.push('/partner/map')}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold hover:bg-indigo-500/20 transition-all shadow-lg shadow-indigo-500/5"
                            >
                                <MapPin className="w-4 h-4" />
                                خريطة المناديب
                            </button>
                        </div>

                        {/* Driver List */}
                        <div className="space-y-4">
                            {stats?.drivers?.length === 0 ? (
                                <div className="text-center py-16 bg-white dark:bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-300 dark:border-white/10">
                                    <p className="text-slate-500 font-medium">لا يوجد مناديب نشطين حالياً</p>
                                </div>
                            ) : (
                                stats?.drivers?.map((driver: any, idx: number) => (
                                    <motion.div
                                        key={driver.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => router.push(`/partner/tracking/${driver.id}?name=${encodeURIComponent(driver.name_ar || driver.name)}&username=${driver.username}`)}
                                        className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-5 shadow-xl hover:border-violet-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={driver.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name_ar || driver.name)}&background=8b5cf6&color=fff`}
                                                        alt={driver.name_ar || driver.name}
                                                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 dark:border-white/10 group-hover:border-violet-500/50 transition-all shadow-lg"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#0F172A] rounded-full" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{driver.name_ar || driver.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">ID: {driver.id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-500/20 transition-all">
                                                <MapPin className="w-5 h-5 text-slate-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 dark:bg-black/20 rounded-[1.5rem] p-4 border border-slate-100 dark:border-white/5 text-center">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 font-bold">تم التسليم</p>
                                                <p className="text-xl font-bold text-slate-800 dark:text-white leading-none">{driver.delivered || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-black/20 rounded-[1.5rem] p-4 border border-slate-100 dark:border-white/5 text-center">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 font-bold">الأرباح</p>
                                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">{parseFloat(driver.delivery_fees || 0).toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* FABs - Themed */}
            <button
                onClick={() => router.push('/partner/orders')}
                title="عرض جميع الطلبات"
                className="fixed left-6 bottom-24 w-14 h-14 rounded-2xl bg-orange-500 text-white shadow-xl shadow-orange-500/20 flex items-center justify-center hover:bg-orange-600 transition-all hover:scale-110 active:scale-90 z-50 border-b-4 border-orange-700"
            >
                <ListOrdered className="w-6 h-6" />
            </button>

            <button
                onClick={() => router.push('/partner/orders/create')}
                title="إنشاء طلب جديد"
                className="fixed left-6 bottom-6 w-14 h-14 rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 flex items-center justify-center hover:bg-emerald-600 transition-all hover:scale-110 active:scale-90 z-50 border-b-4 border-emerald-700"
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
}
