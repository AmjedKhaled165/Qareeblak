"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowRight,
    DollarSign,
    Package,
    CheckCircle,
    Clock,
    TrendingUp,
    MapPin
} from "lucide-react";
import { apiCall } from "@/lib/api";

export default function DriverStatsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [ordersList, setOrdersList] = useState<any[]>([]);
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [isLoading, setIsLoading] = useState(true);

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
        setUser(JSON.parse(storedUser));
        fetchStats();
    }, [period]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            // Fetch courier history for stats
            console.log('📊 Fetching stats for period:', period);
            const data = await apiCall(`/halan/orders/courier/history?period=${period}`);
            console.log('📊 Stats API Response:', data);

            if (data.success) {
                const orders = data.data || [];
                console.log('📊 Orders received:', orders.length);
                setOrdersList(orders);

                // Calculate stats
                const delivered = orders.filter((o: any) => o.status === 'delivered').length;
                const pending = orders.filter((o: any) => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status)).length;
                const totalEarnings = orders
                    .filter((o: any) => o.status === 'delivered')
                    .reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);

                const calculatedStats = {
                    delivered,
                    pending,
                    totalEarnings,
                    totalOrders: orders.length
                };
                console.log('📊 Calculated stats:', calculatedStats);
                setStats(calculatedStats);
            } else {
                console.error('📊 Stats API returned error:', data.error);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => router.back()} className="p-2">
                        <ArrowRight className="w-6 h-6 text-foreground" />
                    </button>
                    <h1 className="text-2xl font-bold text-foreground flex-1">تقرير الأداء</h1>
                </div>

                {/* Period Toggles */}
                <div className="flex gap-2 justify-center">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key as any)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${period === p.key
                                ? 'bg-white text-green-700'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Main Earnings Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <DollarSign className="w-10 h-10 opacity-80" />
                                <TrendingUp className="w-6 h-6 opacity-60" />
                            </div>
                            <p className="text-white/80 mb-1">أرباح قريبلك</p>
                            <p className="text-4xl font-bold">{stats?.totalEarnings?.toFixed(0) || 0} ج.م</p>
                        </motion.div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm"
                            >
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats?.delivered || 0}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">طلبات مكتملة</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm"
                            >
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats?.pending || 0}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">طلبات نشطة</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm col-span-2"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">إجمالي الطلبات</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats?.totalOrders || 0}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                                        <Package className="w-6 h-6 text-violet-600" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Performance Tips */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 نصيحة</h3>
                            <p className="text-blue-700 dark:text-blue-200 text-sm">
                                للحصول على المزيد من الطلبات، تأكد من تفعيل التتبع دائماً والاستجابة السريعة للطلبات الجديدة.
                            </p>
                        </div>

                        {/* Delivered Orders List */}
                        <div className="pt-2 pb-8">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 px-2">تفاصيل الطلبات المكتملة</h3>
                            <div className="space-y-3">
                                {ordersList.filter((o: any) => o.status === 'delivered').length === 0 ? (
                                    <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500 text-sm">لا توجد طلبات مكتملة في هذه الفترة</p>
                                    </div>
                                ) : (
                                    ordersList
                                        .filter((o: any) => o.status === 'delivered')
                                        .map((order: any, idx: number) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 + (idx * 0.05) }}
                                                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border-r-4 border-green-500 flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-800 dark:text-slate-100">
                                                            {order.customer_name || 'عميل'} #{order.id}
                                                        </span>
                                                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                            تم التوصيل
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {order.delivery_address || order.customer_address || 'غير محدد'}
                                                    </p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-bold text-xl text-green-600 dark:text-green-400">
                                                        {(order.delivery_fee || 0)} <span className="text-xs font-normal">ج.م</span>
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">ربح التوصيل</p>
                                                </div>
                                            </motion.div>
                                        ))
                                )}
                            </div>
                        </div>
                    </>
                )
                }
            </div >
        </div >
    );
}
