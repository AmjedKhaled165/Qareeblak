"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Settings, LogOut, Package, Clock, CheckCircle, TrendingUp, DollarSign, User, MapPin, Search, Filter, Plus, Users, RefreshCw, BarChart3, ListOrdered, Bike, ShoppingBag } from "lucide-react";

import { apiCall } from "@/lib/api";

// Stats Card Component with Light/Dark Mode Support
function StatsCard({ title, value, icon: Icon, color, onClick }: { title: string; value: string | number; icon: any; color: string; onClick?: () => void }) {
    // Determine color classes based on the color key passed
    const getColorClasses = (colorKey: string) => {
        switch (colorKey.toLowerCase()) {
            case '#10b981':
            case 'emerald':
                return {
                    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
                    border: 'border-emerald-200 dark:border-emerald-500/30',
                    text: 'text-emerald-600 dark:text-emerald-400',
                    iconBg: 'bg-emerald-500'
                };
            case '#06b6d4':
            case 'cyan':
                return {
                    bg: 'bg-cyan-100 dark:bg-cyan-500/20',
                    border: 'border-cyan-200 dark:border-cyan-500/30',
                    text: 'text-cyan-600 dark:text-cyan-400',
                    iconBg: 'bg-cyan-500'
                };
            case '#3b82f6':
            case 'blue':
                return {
                    bg: 'bg-blue-100 dark:bg-blue-500/20',
                    border: 'border-blue-200 dark:border-blue-500/30',
                    text: 'text-blue-600 dark:text-blue-400',
                    iconBg: 'bg-blue-500'
                };
            case '#6366f1':
            case 'indigo':
                return {
                    bg: 'bg-indigo-100 dark:bg-indigo-500/20',
                    border: 'border-indigo-200 dark:border-indigo-500/30',
                    text: 'text-indigo-600 dark:text-indigo-400',
                    iconBg: 'bg-indigo-500'
                };
            case '#8b5cf6':
            case 'violet':
                return {
                    bg: 'bg-violet-100 dark:bg-violet-500/20',
                    border: 'border-violet-200 dark:border-violet-500/30',
                    text: 'text-violet-600 dark:text-violet-400',
                    iconBg: 'bg-violet-500'
                };
            case '#f59e0b':
            case 'amber':
                return {
                    bg: 'bg-amber-100 dark:bg-amber-500/20',
                    border: 'border-amber-200 dark:border-amber-500/30',
                    text: 'text-amber-600 dark:text-amber-400',
                    iconBg: 'bg-amber-500'
                };
            default:
                return {
                    bg: 'bg-slate-100 dark:bg-slate-500/20',
                    border: 'border-slate-200 dark:border-slate-500/30',
                    text: 'text-slate-600 dark:text-slate-400',
                    iconBg: 'bg-slate-500'
                };
        }
    };

    const classes = getColorClasses(color);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`
                bg-white dark:bg-slate-800
                backdrop-blur-xl 
                border border-slate-200 dark:border-slate-700
                rounded-2xl p-5 
                shadow-lg shadow-slate-200/50 dark:shadow-none
                flex-1 min-w-[150px] 
                ${onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-3">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${classes.bg} border ${classes.border}`}
                >
                    <Icon className={`w-6 h-6 ${classes.text}`} />
                </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        </motion.div>
    );
}

export default function OwnerDashboard() {
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

        // Only owner can access this page
        if (userData.role !== 'owner') {
            if (userData.role === 'courier') {
                router.push('/partner/driver');
            } else {
                router.push('/partner/manager');
            }
            return;
        }

        fetchStats();
    }, []);

    useEffect(() => {
        if (user && user.role === 'owner') {
            setIsLoading(true);
            fetchStats();

            // Auto-refresh every 10 seconds
            const interval = setInterval(fetchStats, 10000);
            return () => clearInterval(interval);
        }
    }, [period, user]);

    const fetchStats = async () => {
        try {
            // Fetch all users (supervisors and couriers)
            const usersData = await apiCall('/halan/users');

            // Fetch all orders
            const ordersData = await apiCall('/halan/orders');

            const users = usersData.success ? usersData.data : [];
            const orders = ordersData.success ? ordersData.data : [];

            // Separate managers (supervisors) and drivers (couriers)
            const managers = users.filter((u: any) => u.role === 'supervisor');
            const drivers = users.filter((u: any) => u.role === 'courier');

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

            // Calculate global stats (filtered by period)
            const filteredOrders = orders.filter((o: any) => isDateInPeriod(o.created_at, period));
            const deliveredOrders = filteredOrders.filter((o: any) => o.status === 'delivered');
            const totalFees = deliveredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
            const totalSales = deliveredOrders.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);

            // Calculate Qareeblak delivery revenue (only delivery fees from Qareeblak orders)
            const qareeblakOrders = deliveredOrders.filter((o: any) => o.source === 'qareeblak');
            const qareeblakDeliveryRevenue = qareeblakOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);

            // Create managers data with their stats
            const managersWithStats = managers.map((m: any) => {
                const assignedDrivers = drivers.filter((d: any) =>
                    (d.isAvailable) &&
                    (d.supervisorIds || []).map((id: any) => Number(id)).includes(Number(m.id))
                );

                const managerOrders = filteredOrders.filter((o: any) =>
                    Number(o.supervisor_id) === Number(m.id)
                );

                const mDelivered = managerOrders.filter((o: any) => o.status === 'delivered');
                const managerFees = mDelivered.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
                const managerSales = mDelivered.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);

                return {
                    ...m,
                    manager_name: m.name,
                    driver_count: assignedDrivers.length,
                    total_orders: managerOrders.length,
                    delivery_fees: managerFees,
                    sales: managerSales
                };
            });

            setStats({
                summary: {
                    total_delivery_fees: totalFees,
                    total_sales: totalSales,
                    delivered: deliveredOrders.length,
                    total_orders: orders.length,
                    qareeblak_delivery_revenue: qareeblakDeliveryRevenue,
                    qareeblak_orders_count: qareeblakOrders.length
                },
                managers: managersWithStats,
                driversCount: drivers.length
            });

        } catch (error: any) {
            console.error('Error fetching stats:', error);
            // If token was cleared by apiCall (due to 401), redirect to login
            if (typeof window !== 'undefined' && !localStorage.getItem('halan_token')) {
                router.replace('/login/partner');
            }
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
        <div className="min-h-screen bg-background text-foreground font-cairo transition-colors duration-500" dir="rtl">
            {/* Midnight Blue Header */}
            <div
                className="p-8 pt-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#1E1B4B] border-b border-white/5"
            >
                {/* Decorative Orbs */}
                <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-20%] right-[-5%] w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]" />

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-sm">لوحة المالك</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <p className="text-slate-400 text-sm">نظرة شاملة على النظام</p>
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
                    <div className="flex gap-2 p-1.5 bg-black/20 backdrop-blur-md rounded-2xl w-fit mx-auto border border-white/5">
                        {periods.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key as any)}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${period === p.key
                                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                        <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-slate-400 animate-pulse">جاري تحميل البيانات...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        {stats?.summary && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                                <StatsCard
                                    title="إجمالي الإيرادات"
                                    value={`${parseFloat(stats.summary.total_delivery_fees || 0).toFixed(0)} ج.م`}
                                    icon={DollarSign}
                                    color="#10B981"
                                />
                                <StatsCard
                                    title="Qareeblak - رسوم التوصيل"
                                    value={`${parseFloat(stats.summary.qareeblak_delivery_revenue || 0).toFixed(0)} ج.م`}
                                    icon={Bike}
                                    color="#8B5CF6"
                                    onClick={() => router.push('/partner/owner-orders?source=qareeblak')}
                                />
                                <StatsCard
                                    title="طلبات ناجحة"
                                    value={stats.summary.delivered}
                                    icon={CheckCircle}
                                    color="#6366F1"
                                />
                                <StatsCard
                                    title="كل الطلبات"
                                    value={stats.summary.total_orders}
                                    icon={ListOrdered}
                                    color="#F59E0B"
                                    onClick={() => router.push('/partner/owner-orders')}
                                />
                            </div>
                        )}

                        {/* Quick Actions Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-1 h-6 bg-indigo-500 rounded-full" />
                                أداء المناطق (المسؤولين)
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => router.push('/partner/map')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
                                >
                                    <MapPin className="w-4 h-4" />
                                    الخريطة
                                </button>
                                <button
                                    onClick={() => router.push('/partner/managers')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 rounded-xl text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-500/20 transition-all shadow-sm"
                                >
                                    <Users className="w-4 h-4" />
                                    المسؤولين
                                </button>
                                <button
                                    onClick={() => router.push('/partner/all-drivers')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-all shadow-sm"
                                >
                                    <Bike className="w-4 h-4" />
                                    المناديب
                                </button>
                                <button
                                    onClick={() => router.push('/partner/products')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20 rounded-xl text-xs font-bold hover:bg-pink-200 dark:hover:bg-pink-500/20 transition-all shadow-sm"
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    المنتجات
                                </button>
                            </div>
                        </div>

                        {/* Managers List */}
                        <div className="space-y-4">
                            {stats?.managers?.length === 0 ? (
                                <div className="text-center py-16 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
                                    <p className="text-slate-500">لا يوجد مسؤولين حالياً</p>
                                </div>
                            ) : (
                                stats?.managers?.map((manager: any, idx: number) => (
                                    <motion.div
                                        key={manager.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none hover:border-indigo-300 dark:hover:border-primary/30 transition-all group"
                                    >
                                        {/* Manager Header */}
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={manager.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.manager_name || 'M')}&background=6366f1&color=fff`}
                                                        alt={manager.manager_name}
                                                        className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 dark:border-white/10 group-hover:border-indigo-400 dark:group-hover:border-primary/50 transition-all shadow-lg"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#0F172A] rounded-full" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-primary transition-colors">{manager.manager_name}</p>
                                                    <p className="text-xs text-slate-500 font-medium">مسؤول منطقة</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => router.push(`/partner/managers/${manager.id}`)}
                                                className="px-5 py-2 bg-indigo-100 dark:bg-primary/10 text-indigo-600 dark:text-primary border border-indigo-200 dark:border-primary/20 rounded-full text-xs font-bold hover:bg-indigo-500 hover:text-white dark:hover:bg-primary dark:hover:text-white transition-all shadow-sm"
                                            >
                                                {manager.driver_count || 0} مناديب
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-black/20 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                            <div
                                                onClick={() => router.push(`/partner/orders?supervisorId=${manager.id}`)}
                                                className="cursor-pointer hover:bg-white dark:hover:bg-white/5 p-3 rounded-xl transition-all text-center"
                                            >
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">الطلبات</p>
                                                <p className="text-xl font-bold text-slate-900 dark:text-white">{manager.total_orders}</p>
                                            </div>
                                            <div
                                                onClick={() => router.push(`/partner/owner-orders?source=qareeblak&supervisorId=${manager.id}`)}
                                                className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10 p-3 rounded-xl text-center border-x border-slate-200 dark:border-white/5 transition-all"
                                            >
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">التوصيل</p>
                                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(manager.delivery_fees || 0).toFixed(0)}</p>
                                            </div>
                                            <div className="p-3 rounded-xl text-center">
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">المبيعات</p>
                                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{parseFloat(manager.sales || 0).toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
