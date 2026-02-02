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
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md flex-1 min-w-[150px]"
        >
            <div className="flex justify-between items-start mb-3">
                <div
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color + '20' }}
                >
                    <Icon className="w-6 h-6" style={{ color }} />
                </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
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

            setStats({
                summary: {
                    total_delivery_fees: totalFees,
                    total_sales: totalSales,
                    delivered: deliveredOrders.length,
                    total_drivers: drivers.length
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Violet Gradient Header - Manager specific */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg"
                style={{
                    background: 'linear-gradient(135deg, #624AF2 0%, #504DFF 100%)'
                }}
            >
                <div className="flex justify-between items-center mb-5">
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-white mb-1">لوحة القيادة</h1>
                        <p className="text-white/80 text-sm">إدارة الفريق والأداء</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onRefresh}
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => router.push('/partner/settings')}
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <Settings className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <LogOut className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Period Toggles */}
                <div className="flex gap-2 justify-center">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key as any)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${period === p.key
                                ? 'bg-white text-violet-600'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 pb-24">

                {isLoading && !stats ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        {stats?.summary && (
                            <div className="space-y-3 mb-6">
                                <div className="flex gap-3">
                                    <StatsCard
                                        title="إجمالي الدخل"
                                        value={parseFloat(stats.summary.total_delivery_fees || 0).toFixed(0)}
                                        icon={DollarSign}
                                        color="#4CAF50"
                                    />
                                    <StatsCard
                                        title="المبيعات"
                                        value={parseFloat(stats.summary.total_sales || 0).toFixed(0)}
                                        icon={ShoppingCart}
                                        color="#2196F3"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <StatsCard
                                        title="طلبات ناجحة"
                                        value={stats.summary.delivered}
                                        icon={CheckCircle}
                                        color="#504DFF"
                                    />
                                    <StatsCard
                                        title="المناديب"
                                        value={stats.summary.total_drivers}
                                        icon={Users}
                                        color="#FF9800"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Section Title & Map Button */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">أداء المناديب</h2>
                            <button
                                onClick={() => router.push('/partner/map')}
                                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-full text-xs font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                <MapPin className="w-4 h-4" />
                                الخريطة
                            </button>
                        </div>

                        {/* Driver List - Click to track */}
                        <div className="space-y-3">
                            {stats?.drivers?.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    لا يوجد مناديب
                                </div>
                            ) : (
                                stats?.drivers?.map((driver: any) => (
                                    <motion.div
                                        key={driver.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        whileHover={{ scale: 1.01 }}
                                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between group"
                                    >
                                        <div
                                            className="flex items-center gap-4 flex-1 cursor-pointer"
                                            onClick={() => router.push(`/partner/tracking/${driver.id}?name=${encodeURIComponent(driver.name_ar || driver.name)}&username=${driver.username}`)}
                                        >
                                            <img
                                                src={driver.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name_ar || driver.name)}&background=random`}
                                                alt={driver.name_ar || driver.name}
                                                className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700"
                                            />
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-violet-600 transition-colors">
                                                    {driver.name_ar || driver.name}
                                                </p>
                                                <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
                                                    <span>الطلبات: <span className="font-bold text-slate-700 dark:text-slate-200">{driver.delivered || 0}</span></span>
                                                    <span>|</span>
                                                    <span>الأرباح: <span className="font-bold text-green-600 dark:text-green-400">{parseFloat(driver.delivery_fees || 0).toFixed(0)}</span></span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/partner/tracking/${driver.id}?name=${encodeURIComponent(driver.name_ar || driver.name)}&username=${driver.username}`);
                                            }}
                                            className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            title="تتبع الموقع"
                                        >
                                            <MapPin className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* FABs */}
            <button
                onClick={() => router.push('/partner/orders')}
                className="fixed left-5 bottom-24 w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors z-50"
            >
                <ListOrdered className="w-6 h-6" />
            </button>

            <button
                onClick={() => router.push('/partner/orders/create')}
                className="fixed left-5 bottom-8 w-14 h-14 rounded-full bg-green-500 text-white shadow-lg flex items-center justify-center hover:bg-green-600 transition-colors z-50"
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
}
