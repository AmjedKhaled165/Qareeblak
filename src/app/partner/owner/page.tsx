"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Settings, LogOut, Package, Clock, CheckCircle, TrendingUp, DollarSign, User, MapPin, Search, Filter, Plus, Users, RefreshCw, BarChart3, ListOrdered, Bike, ShoppingBag } from "lucide-react";

import { apiCall } from "@/lib/api";

// Stats Card Component  
function StatsCard({ title, value, icon: Icon, color, onClick }: { title: string; value: string | number; icon: any; color: string; onClick?: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md flex-1 min-w-[150px] ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
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
                    total_orders: orders.length
                },
                managers: managersWithStats,
                driversCount: drivers.length
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
            {/* Navy Blue Gradient Header - Owner specific */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg"
                style={{
                    background: 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)'
                }}
            >
                <div className="flex justify-between items-center mb-5">
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-white mb-1">لوحة المالك</h1>
                        <p className="text-white/80 text-sm">نظرة شاملة على النظام</p>
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
                                ? 'bg-white text-indigo-900'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 pb-8">
                {isLoading && !stats ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        {stats?.summary && (
                            <div className="space-y-3 mb-6">
                                <div className="flex gap-3">
                                    <StatsCard
                                        title="إجمالي الإيرادات"
                                        value={parseFloat(stats.summary.total_delivery_fees || 0).toFixed(0)}
                                        icon={DollarSign}
                                        color="#4CAF50"
                                    />
                                    <StatsCard
                                        title="المبيعات الكلية"
                                        value={parseFloat(stats.summary.total_sales || 0).toFixed(0)}
                                        icon={BarChart3}
                                        color="#2196F3"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <StatsCard
                                        title="طلبات ناجحة"
                                        value={stats.summary.delivered}
                                        icon={CheckCircle}
                                        color="#3949AB"
                                    />
                                    <StatsCard
                                        title="كل الطلبات"
                                        value={stats.summary.total_orders}
                                        icon={ListOrdered}
                                        color="#FF9800"
                                        onClick={() => router.push('/partner/owner-orders')}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">أداء المناطق (المسؤولين)</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => router.push('/partner/map')}
                                    className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-full text-xs font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                    <MapPin className="w-4 h-4" />
                                    الخريطة
                                </button>
                                <button
                                    onClick={() => router.push('/partner/managers')}
                                    className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-full text-xs font-semibold hover:bg-orange-600 transition-colors"
                                >
                                    <Users className="w-4 h-4" />
                                    المسؤولين
                                </button>
                                <button
                                    onClick={() => router.push('/partner/all-drivers')}
                                    className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-full text-xs font-semibold hover:bg-green-600 transition-colors"
                                >
                                    <Bike className="w-4 h-4" />
                                    المناديب
                                </button>
                                <button
                                    onClick={() => router.push('/partner/products')}
                                    className="flex items-center gap-1 px-3 py-2 bg-pink-600 text-white rounded-full text-xs font-semibold hover:bg-pink-700 transition-colors"
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    المنتجات
                                </button>
                            </div>
                        </div>

                        {/* Managers List */}
                        <div className="space-y-3">
                            {stats?.managers?.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    لا يوجد مسؤولين
                                </div>
                            ) : (
                                stats?.managers?.map((manager: any) => (
                                    <motion.div
                                        key={manager.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm"
                                    >
                                        {/* Manager Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={manager.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.manager_name || 'M')}&background=random`}
                                                    alt={manager.manager_name}
                                                    className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700"
                                                />
                                                <p className="font-bold text-slate-800 dark:text-slate-100">{manager.manager_name}</p>
                                            </div>
                                            <span
                                                onClick={() => router.push(`/partner/managers/${manager.id}`)}
                                                className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-semibold cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                            >
                                                {manager.driver_count || 0} مناديب
                                            </span>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                                            <div className="flex justify-between text-center">
                                                <div
                                                    onClick={() => router.push(`/partner/orders?supervisorId=${manager.id}`)}
                                                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                                                >
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">الطلبات</p>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{manager.total_orders}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">أرباح التوصيل</p>
                                                    <p className="font-bold text-green-600 dark:text-green-400">{parseFloat(manager.delivery_fees || 0).toFixed(0)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">المبيعات</p>
                                                    <p className="font-bold text-blue-600 dark:text-blue-400">{parseFloat(manager.sales || 0).toFixed(0)}</p>
                                                </div>
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
