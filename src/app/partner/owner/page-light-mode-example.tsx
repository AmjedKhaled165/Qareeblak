"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Package, CheckCircle, Users, Settings, LogOut, RefreshCw, BarChart3, Store, Truck } from "lucide-react";
import {
    DashboardHeader,
    StatCard,
    StatsGrid,
    SectionCard,
    BottomNavBar,
    PeriodSelector,
    DashboardLoading,
} from "@/components/dashboards/OwnerDashboardLightMode";

export default function OwnerDashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser || JSON.parse(storedUser).role !== 'owner') {
            router.push('/login/partner');
            return;
        }
        setUser(JSON.parse(storedUser));
        setIsLoading(false);
    }, [router]);

    if (isLoading) return <DashboardLoading />;
    if (!user) return null;

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const handleLogout = () => {
        localStorage.removeItem('halan_token');
        localStorage.removeItem('halan_user');
        router.push('/login/partner');
    };

    // Mock data
    const stats = {
        revenue: 45230,
        orders: 247,
        customers: 856,
        completion: 94,
    };

    const managers = [
        { id: 1, name: 'أحمد علي', orders: 52, revenue: 12500, completion: 96 },
        { id: 2, name: 'محمود سالم', orders: 38, revenue: 9300, completion: 91 },
        { id: 3, name: 'علي حسن', orders: 45, revenue: 11200, completion: 94 },
    ];

    const navigationItems = [
        { icon: BarChart3, label: 'المبيعات', active: true },
        { icon: Store, label: 'المعاملات' },
        { icon: Users, label: 'المستخدمين' },
        { icon: Truck, label: 'التوصيل' },
    ];

    return (
        <div className="bg-slate-50 min-h-screen pb-32" dir="rtl">
            {/* Header */}
            <DashboardHeader
                userName={user.name_ar || user.name}
                onRefresh={handleRefresh}
                onLogout={handleLogout}
                isRefreshing={isRefreshing}
            />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Period Selector */}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 font-cairo">إحصائيات الأداء</h2>
                    <PeriodSelector period={period} onPeriodChange={setPeriod} />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="إجمالي الإيرادات"
                        value={`${stats.revenue.toLocaleString()}₪`}
                        icon={DollarSign}
                        type="revenue"
                        trend={{ value: 12, isPositive: true }}
                    />
                    <StatCard
                        title="عدد الطلبات"
                        value={stats.orders}
                        icon={Package}
                        type="orders"
                        trend={{ value: 8, isPositive: true }}
                    />
                    <StatCard
                        title="المستخدمين النشطين"
                        value={stats.customers}
                        icon={Users}
                        type="customers"
                        trend={{ value: 5, isPositive: true }}
                    />
                    <StatCard
                        title="نسبة الإنجاز"
                        value={`${stats.completion}%`}
                        icon={CheckCircle}
                        type="completion"
                        trend={{ value: 2, isPositive: true }}
                    />
                </div>

                {/* Managers Section */}
                <SectionCard
                    title="مديرو الفروع"
                    icon={Users}
                    action={{ label: "إضافة مدير", onClick: () => {} }}
                >
                    <div className="space-y-3">
                        {managers.map(manager => (
                            <div
                                key={manager.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-slate-100"
                                dir="rtl"
                            >
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-900 font-cairo">{manager.name}</h4>
                                    <p className="text-sm text-slate-500">{manager.orders} طلب معالج</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="font-bold text-slate-900">{manager.revenue.toLocaleString()}₪</p>
                                    <p className="text-xs text-emerald-600 font-bold">الإنجاز: {manager.completion}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* Performance Chart Section */}
                <SectionCard title="الأداء خلال الفترة" icon={BarChart3}>
                    <div className="h-64 bg-gradient-to-br from-blue-50 to-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                        <p className="text-slate-500 font-medium">مخطط الأداء سيتم عرضه هنا</p>
                    </div>
                </SectionCard>

                {/* Recent Activity */}
                <SectionCard title="آخر النشاطات" icon={RefreshCw}>
                    <div className="space-y-3">
                        {[
                            { time: 'قبل 5 دقائق', action: 'تم إنجاز طلب رقم #1234', type: 'success' },
                            { time: 'قبل 15 دقيقة', action: 'مندوب جديد تم تسجيله', type: 'info' },
                            { time: 'قبل ساعة', action: 'تم رفع نسبة الإنجاز إلى 94%', type: 'success' },
                        ].map((activity, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-4 p-3 border-b border-slate-100 last:border-b-0"
                                dir="rtl"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900">{activity.action}</p>
                                    <p className="text-xs text-slate-500">{activity.time}</p>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${
                                    activity.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`} />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {/* Bottom Navigation */}
            <BottomNavBar items={navigationItems} />
        </div>
    );
}
