"use client";

import { useState, useEffect } from "react";
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
    Search
} from "lucide-react";
import { motion } from "framer-motion";

export default function FinancePage() {
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("qareeblak_token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/finance/summary`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSummary(data.data);
            } else {
                setError(data.error || "فشل تحميل البيانات");
            }
        } catch (err) {
            setError("حدث خطأ في الاتصال بالسيرفر");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">الإدارة المالية</h1>
                    <p className="text-slate-500 text-sm">متابعة الأرباح، العمولات، وتسوية حسابات مقدمي الخدمة.</p>
                </div>
                <Button onClick={fetchSummary} variant="outline" size="sm" className="gap-2">
                    <History className="w-4 h-4" /> تحديث البيانات
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p>{error}</p>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="إجمالي قيمة التداول" 
                    value={`${summary?.total_gross_value || 0} ج.م`} 
                    icon={TrendingUp} 
                    color="indigo" 
                    subtitle="إجمالي قيمة جميع الطلبات المكتملة"
                />
                <StatCard 
                    title="عمولة التطبيق" 
                    value={`${summary?.total_platform_commission || 0} ج.م`} 
                    icon={ArrowUpRight} 
                    color="emerald" 
                    subtitle="صافي الربح المستحق للمنصة"
                />
                <StatCard 
                    title="مستحقات مقدمي الخدمة" 
                    value={`${summary?.total_provider_earnings || 0} ج.m`} 
                    icon={Wallet} 
                    color="blue" 
                    subtitle="إجمالي مستحقات الشركاء (صافي)"
                />
                <StatCard 
                    title="طلبات قيد التسوية" 
                    value={summary?.unpaid_bookings_count || 0} 
                    icon={Info} 
                    color="amber" 
                    subtitle="عدد الطلبات المكتملة التي لم تُصرف بعد"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            إجمالي الحسابات المالية
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-sm text-slate-500">تم صرفه للملاك/الشركاء</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{summary?.total_payouts_made || 0} ج.م</p>
                                </div>
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600">
                                    <ArrowDownRight className="w-6 h-6" />
                                </div>
                            </div>
                            
                            <div className="p-4 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl">
                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                                    <AlertCircle className="w-4 h-4" /> تنبيه مالي
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    هناك ما يعادل <span className="font-bold text-slate-900 dark:text-white">{(summary?.total_provider_earnings - summary?.total_payouts_made).toFixed(2)} ج.م</span> 
                                    مستحقات لم يتم تسويتها بعد لمقدمي الخدمة.
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
                        <QuickLink label="كشف حساب مقدم خدمة" icon={Search} href="/admin/finance/payouts" />
                        <QuickLink label="تعديل نسبة العمولة" icon={Settings} href="/admin/catalog/pricing" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: any) {
    const colors: any = {
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
                        <Icon className="w-5 h-5" />
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

function QuickLink({ label, icon: Icon, href }: any) {
    return (
        <a 
            href={href}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-sm font-medium text-slate-600 dark:text-slate-400"
        >
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
            </div>
            <ArrowLeft className="w-3 h-3" />
        </a>
    );
}

function Settings(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function ArrowLeft(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}
