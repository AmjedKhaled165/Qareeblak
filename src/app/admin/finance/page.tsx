"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    TrendingUp, 
    Wallet, 
    ArrowUpRight, 
    ArrowDownRight, 
    History, 
    AlertCircle,
    Info,
    CheckCircle2,
    Search,
    ChevronLeft,
    Settings
} from "lucide-react";
import { apiCall } from "@/lib/api";

// ==========================================
// CONSTANTS & TYPES
// ==========================================

const API_ENDPOINTS = {
    GET_SUMMARY: '/admin/finance/summary'
} as const;

const NAVIGATION_ROUTES = {
    PAYOUTS: '/admin/finance/payouts',
    PRICING: '/admin/catalog/pricing'
} as const;

interface FinanceSummary {
    total_gross_value: number;
    total_platform_commission: number;
    total_provider_earnings: number;
    unpaid_bookings_count: number;
    total_payouts_made: number;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: 'indigo' | 'emerald' | 'blue' | 'amber';
    subtitle: string;
}

interface QuickLinkProps {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
}

// ==========================================
// DOMAIN UTILITIES
// ==========================================

const formatCurrency = (value: number): string => {
    return `${value.toFixed(2)} ج.م`;
};

// ==========================================
// RENDER COMPONENTS
// ==========================================

export default function FinancePage() {
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const activeControllerRef = useRef<AbortController | null>(null);

    const fetchSummary = async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);

        try {
            const res = await apiCall<{ success: boolean; data: FinanceSummary; error?: string }>(
                API_ENDPOINTS.GET_SUMMARY, 
                { signal }
            );
            if (res.success && res.data) {
                setSummary(res.data);
            } else {
                setError(res.error || "فشل تحميل البيانات");
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            const message = err instanceof Error ? err.message : String(err);
            setError(message || "حدث خطأ في الاتصال بالسيرفر");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        activeControllerRef.current = controller;
        fetchSummary(controller.signal);

        return () => {
            controller.abort();
        };
    }, []);

    const handleRefetch = () => {
        if (activeControllerRef.current) {
            activeControllerRef.current.abort();
        }
        const controller = new AbortController();
        activeControllerRef.current = controller;
        fetchSummary(controller.signal);
    };

    if (loading) {
        return (
            <div 
                className="flex items-center justify-center h-96" 
                role="status" 
                aria-label="تحميل البيانات المالية"
            >
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const remainingPayouts = (summary?.total_provider_earnings ?? 0) - (summary?.total_payouts_made ?? 0);

    return (
        <div className="space-y-6" dir="rtl">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">الإدارة المالية</h1>
                    <p className="text-slate-500 text-sm">متابعة الأرباح، العمولات، وتسوية حسابات مقدمي الخدمة.</p>
                </div>
                <Button 
                    onClick={handleRefetch} 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label="تحديث البيانات المالية"
                >
                    <History className="w-4 h-4" aria-hidden="true" /> تحديث البيانات
                </Button>
            </header>

            {error && (
                <div 
                    className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3"
                    role="alert"
                >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Stats Overview */}
            <section aria-label="خلاصة الإحصائيات المالية" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="إجمالي قيمة التداول" 
                    value={formatCurrency(summary?.total_gross_value ?? 0)} 
                    icon={TrendingUp} 
                    color="indigo" 
                    subtitle="إجمالي قيمة جميع الطلبات المكتملة"
                />
                <StatCard 
                    title="عمولة التطبيق" 
                    value={formatCurrency(summary?.total_platform_commission ?? 0)} 
                    icon={ArrowUpRight} 
                    color="emerald" 
                    subtitle="صافي الربح المستحق للمنصة"
                />
                <StatCard 
                    title="مستحقات مقدمي الخدمة" 
                    value={formatCurrency(summary?.total_provider_earnings ?? 0)} 
                    icon={Wallet} 
                    color="blue" 
                    subtitle="إجمالي مستحقات الشركاء (صافي)"
                />
                <StatCard 
                    title="طلبات قيد التسوية" 
                    value={summary?.unpaid_bookings_count ?? 0} 
                    icon={Info} 
                    color="amber" 
                    subtitle="عدد الطلبات المكتملة التي لم تُصرف بعد"
                />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                            إجمالي الحسابات المالية
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-sm text-slate-500">تم صرفه للملاك/الشركاء</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(summary?.total_payouts_made ?? 0)}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600">
                                    <ArrowDownRight className="w-6 h-6" aria-hidden="true" />
                                </div>
                            </div>
                            
                            <div className="p-4 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl">
                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                                    <AlertCircle className="w-4 h-4" aria-hidden="true" /> تنبيه مالي
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    هناك ما يعادل <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(remainingPayouts)}</span> مستحقات لم يتم تسويتها بعد لمقدمي الخدمة.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg">روابط سريعة</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <nav aria-label="روابط الإدارة المالية السريعة" className="space-y-2">
                            <QuickLink 
                                label="كشف حساب مقدم خدمة" 
                                icon={Search} 
                                href={NAVIGATION_ROUTES.PAYOUTS} 
                            />
                            <QuickLink 
                                label="تعديل نسبة العمولة" 
                                icon={Settings} 
                                href={NAVIGATION_ROUTES.PRICING} 
                            />
                        </nav>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
    const colors: Record<string, string> = {
        indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
        emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
        blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
        amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
    };

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${colors[color]}`}>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                </div>
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</h3>
                    <p className="text-[10px] text-slate-400 mt-2">{subtitle}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function QuickLink({ label, icon: Icon, href }: QuickLinkProps) {
    return (
        <a 
            href={href}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-sm font-medium text-slate-600 dark:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
            </div>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </a>
    );
}
