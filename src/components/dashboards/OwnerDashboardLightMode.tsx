"use client";

import { motion } from "framer-motion";
import { DollarSign, Package, CheckCircle, Users, Settings, LogOut, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { LIGHT_MODE_COLORS, getAccentColorClasses } from "@/styles/light-mode-colors";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFESSIONAL STAT CARD - Light Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    type: 'revenue' | 'orders' | 'customers' | 'completion';
    onClick?: () => void;
    trend?: { value: number; isPositive: boolean };
}

export function StatCard({ title, value, icon: Icon, type, onClick, trend }: StatCardProps) {
    const colorClasses = getAccentColorClasses(type);
    const color = LIGHT_MODE_COLORS.accents[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, boxShadow: LIGHT_MODE_COLORS.shadows.hover }}
            onClick={onClick}
            className={`bg-white rounded-2xl p-6 border border-slate-100 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${onClick ? 'cursor-pointer hover:border-slate-200' : ''
                }`}
        >
            {/* Header with Icon */}
            <div className="flex items-start justify-between mb-4">
                <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClasses.bg} border ${colorClasses.border}`}
                >
                    <Icon className={`w-7 h-7 ${colorClasses.icon}`} />
                </div>

                {trend && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${trend.isPositive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                    </div>
                )}
            </div>

            {/* Value */}
            <p className="text-3xl font-black text-slate-900 mb-1 font-cairo">{value}</p>

            {/* Title */}
            <p className="text-sm font-medium text-slate-600">{title}</p>
        </motion.div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEADER WITH NAVIGATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface HeaderProps {
    userName: string;
    onSettings?: () => void;
    onLogout?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function DashboardHeader({ userName, onSettings, onLogout, onRefresh, isRefreshing }: HeaderProps) {
    return (
        <div
            className="bg-white border-b border-slate-100 px-6 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
        >
            <div className="flex items-center justify-between" dir="rtl">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 font-cairo">لوحة المالك</h1>
                    <p className="text-sm text-slate-500">نظرة شاملة على النظام</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Refresh Button */}
                    <motion.button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw
                            className={`w-5 h-5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                    </motion.button>

                    {/* Settings Button */}
                    <motion.button
                        onClick={onSettings}
                        whileHover={{ scale: 1.05 }}
                        className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        <Settings className="w-5 h-5 text-slate-600" />
                    </motion.button>

                    {/* Logout Button */}
                    <motion.button
                        onClick={onLogout}
                        whileHover={{ scale: 1.05 }}
                        className="p-2.5 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
                    >
                        <LogOut className="w-5 h-5 text-red-600" />
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PERIOD SELECTOR - Light Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PeriodSelectorProps {
    period: 'today' | 'week' | 'month';
    onPeriodChange: (period: 'today' | 'week' | 'month') => void;
}

export function PeriodSelector({ period, onPeriodChange }: PeriodSelectorProps) {
    const periods = [
        { key: 'today' as const, label: 'اليوم' },
        { key: 'week' as const, label: 'هذا الأسبوع' },
        { key: 'month' as const, label: 'هذا الشهر' },
    ];

    return (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit" dir="rtl">
            {periods.map(p => (
                <motion.button
                    key={p.key}
                    onClick={() => onPeriodChange(p.key)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${period === p.key
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-transparent text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {p.label}
                </motion.button>
            ))}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATS GRID - Light Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StatsGridProps {
    revenue: number;
    orders: number;
    customers: number;
    completion: number;
}

export function StatsGrid({ revenue, orders, customers, completion }: StatsGridProps) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="الإيرادات"
                value={`${revenue.toFixed(0)}₪`}
                icon={DollarSign}
                type="revenue"
                trend={{ value: 12, isPositive: true }}
            />
            <StatCard
                title="الطلبات"
                value={orders}
                icon={Package}
                type="orders"
                trend={{ value: 8, isPositive: true }}
            />
            <StatCard
                title="المستخدمين"
                value={customers}
                icon={Users}
                type="customers"
                trend={{ value: 3, isPositive: true }}
            />
            <StatCard
                title="المكتملة"
                value={`${completion}%`}
                icon={CheckCircle}
                type="completion"
                trend={{ value: 5, isPositive: true }}
            />
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION CARD - Reusable Container
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SectionCardProps {
    title: string;
    icon?: any;
    children: React.ReactNode;
    action?: { label: string; onClick: () => void };
}

export function SectionCard({ title, icon: Icon, children, action }: SectionCardProps) {
    return (
        <div
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
        >
            {/* Header */}
            <div
                className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
                dir="rtl"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-6 h-6 text-blue-600" />}
                    <h2 className="text-lg font-bold text-slate-900 font-cairo">{title}</h2>
                </div>
                {action && (
                    <motion.button
                        onClick={action.onClick}
                        whileHover={{ scale: 1.05 }}
                        className="px-3 py-1.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {action.label}
                    </motion.button>
                )}
            </div>

            {/* Content */}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NAVIGATION BAR - Bottom Navigation Light Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NavItem {
    icon: any;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

interface BottomNavBarProps {
    items: NavItem[];
}

export function BottomNavBar({ items }: BottomNavBarProps) {
    return (
        <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center shadow-[0_-2px_8px_rgba(0,0,0,0.02),0_2px_8px_rgba(0,0,0,0.02)]"
            dir="rtl"
        >
            {items.map((item, idx) => (
                <motion.button
                    key={idx}
                    onClick={item.onClick}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${item.active
                            ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-bold">{item.label}</span>
                </motion.button>
            ))}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOADING STATE - Light Mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DashboardLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" dir="rtl">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4"
            />
            <p className="text-slate-600 font-bold">جاري تحميل لوحة المالك...</p>
        </div>
    );
}
