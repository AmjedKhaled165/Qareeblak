"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings, RefreshCw, MapPin, LogOut,
    BarChart3, Package, Users, ShoppingBag
} from "lucide-react";

import { apiCall } from "@/lib/api";
import OwnerOverviewTab from "./tabs/OwnerOverviewTab";
import OwnerOrdersTab from "./tabs/OwnerOrdersTab";
import OwnerTeamTab from "./tabs/OwnerTeamTab";
import OwnerProductsTab from "./tabs/OwnerProductsTab";
import OwnerSettingsDrawer from "./tabs/OwnerSettingsDrawer";
import OwnerMapModal from "./tabs/OwnerMapModal";

type TabKey = 'overview' | 'orders' | 'team' | 'products';

const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: BarChart3 },
    { key: 'orders', label: 'الطلبات', icon: Package },
    { key: 'team', label: 'الفريق', icon: Users },
    { key: 'products', label: 'المنتجات', icon: ShoppingBag },
];

export default function OwnerDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [rawUsers, setRawUsers] = useState<any[]>([]);
    const [rawOrders, setRawOrders] = useState<any[]>([]);
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
    const [customDateInput, setCustomDateInput] = useState<string>('');
    const [activeCustomDate, setActiveCustomDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const isFetchingRef = useRef(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Overlay states
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    const periods = [
        { key: 'today', label: 'اليوم' },
        { key: 'week', label: 'هذا الأسبوع' },
        { key: 'month', label: 'هذا الشهر' },
    ];

    const buildStatsFromData = useCallback((users: any[], orders: any[], selectedPeriod: 'today' | 'week' | 'month' | 'custom', customDateVal?: string) => {
        const managers = users.filter((u: any) => u.role === 'supervisor');
        const drivers = users.filter((u: any) => u.role === 'courier');

        const getGrandTotal = (o: any) => {
            let items: any[] = [];
            try { items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []); } catch { items = []; }
            const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
            const deliFee = parseFloat(o.delivery_fee?.toString() || '0');
            return itemsTotal + deliFee;
        };

        const isDateInPeriod = (dateString: string, p: string) => {
            const date = new Date(dateString);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            if (p === 'today') return date >= start;
            if (p === 'week') { const day = start.getDay(); const diff = (day + 1) % 7; start.setDate(start.getDate() - diff); return date >= start; }
            if (p === 'month') { start.setDate(1); return date >= start; }
            if (p === 'custom' && customDateVal) { const cs = new Date(customDateVal); cs.setHours(0, 0, 0, 0); const ce = new Date(customDateVal); ce.setHours(23, 59, 59, 999); return date >= cs && date <= ce; }
            return true;
        };

        const filteredOrders = orders.filter((o: any) => isDateInPeriod(o.created_at, selectedPeriod));
        const deliveredOrders = filteredOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
        const totalFees = deliveredOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
        const totalSales = deliveredOrders.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);

        const qareeblakOrders = deliveredOrders.filter((o: any) => o.source === 'qareeblak');
        const qareeblakDeliveryRevenue = qareeblakOrders.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);

        const managersWithStats = managers.map((m: any) => {
            const assignedDrivers = drivers.filter((d: any) => (d.isAvailable) && (d.supervisorIds || []).map((id: any) => Number(id)).includes(Number(m.id)));
            const managerOrders = filteredOrders.filter((o: any) => Number(o.supervisor_id) === Number(m.id));
            const mDelivered = managerOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
            const managerFees = mDelivered.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
            const managerSales = mDelivered.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);
            return { ...m, manager_name: m.name, driver_count: assignedDrivers.length, total_orders: managerOrders.length, delivery_fees: managerFees, sales: managerSales };
        });

        return {
            summary: { total_delivery_fees: totalFees, total_sales: totalSales, delivered: deliveredOrders.length, total_orders: filteredOrders.length, qareeblak_delivery_revenue: qareeblakDeliveryRevenue, qareeblak_orders_count: qareeblakOrders.length },
            managers: managersWithStats,
            driversCount: drivers.length
        };
    }, []);

    const fetchStats = useCallback(async ({ showBlockingLoader = false }: { showBlockingLoader?: boolean } = {}) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (showBlockingLoader && !stats) setIsLoading(true);

        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) { router.push('/login/partner'); isFetchingRef.current = false; return; }
        const userData = JSON.parse(storedUser);
        const normalizedRole = String(userData.role || '').replace(/^partner_/, '');
        setUser((prev: any) => prev || userData);

        if (normalizedRole !== 'owner') {
            router.push(normalizedRole === 'courier' ? '/partner/driver' : '/partner/manager');
            isFetchingRef.current = false; return;
        }

        try {
            const [usersData, ordersData] = await Promise.all([apiCall('/halan/users'), apiCall('/halan/orders')]);
            const users = usersData.success ? usersData.data : [];
            const orders = ordersData.success ? ordersData.data : [];
            setRawUsers(users); setRawOrders(orders);
            setStats(buildStatsFromData(users, orders, period, activeCustomDate));
        } catch (error: any) {
            console.error('Error fetching stats:', error);
            if (typeof window !== 'undefined' && !localStorage.getItem('halan_token')) router.replace('/login/partner');
        } finally {
            setIsLoading(false); setRefreshing(false); isFetchingRef.current = false;
        }
    }, [period, router, buildStatsFromData, activeCustomDate, stats]);

    useEffect(() => { fetchStats({ showBlockingLoader: true }); }, []);
    useEffect(() => { const interval = setInterval(() => fetchStats({ showBlockingLoader: false }), 60000); return () => clearInterval(interval); }, [fetchStats]);
    useEffect(() => { if (rawUsers.length > 0 && rawOrders.length > 0) setStats(buildStatsFromData(rawUsers, rawOrders, period, activeCustomDate)); }, [period, activeCustomDate, rawUsers, rawOrders, buildStatsFromData]);

    const onRefresh = () => { setRefreshing(true); fetchStats({ showBlockingLoader: false }); };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background text-foreground font-cairo transition-colors duration-500" dir="rtl">
            {/* ═══════ HEADER ═══════ */}
            <div className="p-8 pt-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#1E1B4B] border-b border-white/5">
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
                            <button onClick={onRefresh} title="تحديث البيانات"
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10">
                                <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => setMapOpen(true)} title="خريطة المناديب"
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10">
                                <MapPin className="w-5 h-5 text-white" />
                            </button>
                            <button onClick={() => setSettingsOpen(true)} title="الإعدادات"
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10">
                                <Settings className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Period Toggles */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex gap-2 p-1.5 bg-black/20 backdrop-blur-md rounded-2xl w-fit border border-white/5 overflow-x-auto">
                            {periods.map((p) => (
                                <button key={p.key} onClick={() => setPeriod(p.key as any)}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${period === p.key ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                    {p.label}
                                </button>
                            ))}
                            <button onClick={() => setPeriod('custom')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${period === 'custom' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                تحديد يوم
                            </button>
                        </div>

                        {period === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={customDateInput} onChange={(e) => setCustomDateInput(e.target.value)}
                                    className="px-4 py-2.5 rounded-xl text-sm bg-white/10 border border-white/20 text-white font-bold focus:ring-2 focus:ring-primary outline-none" />
                                <button onClick={() => setActiveCustomDate(customDateInput)}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30">
                                    تم
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ═══════ TAB BAR ═══════ */}
                    <div className="flex gap-1 p-1.5 bg-black/20 backdrop-blur-md rounded-2xl mt-6 border border-white/5 overflow-x-auto">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                        ? 'bg-white text-slate-900 shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className={isActive ? '' : 'hidden sm:inline'}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ═══════ CONTENT ═══════ */}
            <div className="w-full p-6 pb-20">
                {isLoading && !stats ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-slate-400 animate-pulse">جاري تحميل البيانات...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div key="overview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                                <OwnerOverviewTab stats={stats} onNavigateTab={(tab) => setActiveTab(tab as TabKey)} />
                            </motion.div>
                        )}
                        {activeTab === 'orders' && (
                            <motion.div key="orders" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                                <OwnerOrdersTab period={period} customDate={activeCustomDate} />
                            </motion.div>
                        )}
                        {activeTab === 'team' && (
                            <motion.div key="team" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                                <OwnerTeamTab period={period} customDate={activeCustomDate} />
                            </motion.div>
                        )}
                        {activeTab === 'products' && (
                            <motion.div key="products" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                                <OwnerProductsTab period={period} customDate={activeCustomDate} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* ═══════ OVERLAYS ═══════ */}
            <OwnerSettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <OwnerMapModal isOpen={mapOpen} onClose={() => setMapOpen(false)} />
        </div>
    );
}
