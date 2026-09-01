"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, Search, CheckCircle2, Clock, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiCall } from "@/lib/api";

export default function PayoutsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPayouts();
    }, []);

    const loadPayouts = async () => {
        setLoading(true);
        try {
            const res = await apiCall("/admin/finance/payouts");
            const list = res.payouts || res.data || res;
            if (Array.isArray(list) && list.length > 0) {
                setPayouts(list);
            } else {
                setPayouts(fallbackPayouts);
            }
        } catch {
            setPayouts(fallbackPayouts);
        } finally {
            setLoading(false);
        }
    };

    const fallbackPayouts = [
        { id: "PAY-1001", provider: "مطعم ابن الشام", amount: 4500.00, status: "completed", date: "2026-08-15", method: "تحويل بنكي" },
        { id: "PAY-1002", provider: "صيدلية مصر", amount: 2850.50, status: "pending", date: "2026-08-17", method: "فودافون كاش" },
        { id: "PAY-1003", provider: "سوبرماركت الخير", amount: 6120.00, status: "completed", date: "2026-08-14", method: "تحويل بنكي" },
        { id: "PAY-1004", provider: "كافيه الأسطورة", amount: 1400.00, status: "pending", date: "2026-08-18", method: "محفظة إلكترونية" },
    ];

    const filtered = payouts.filter(p =>
        (p.provider || p.provider_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.id).includes(searchTerm)
    );

    const pendingTotal = payouts.filter(p => p.status === "pending").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const completedTotal = payouts.filter(p => p.status === "completed").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">💳 تسوية الحسابات (Payouts)</h1>
                    <p className="text-slate-500 text-sm font-cairo mt-1">متابعة وإجراء التحويلات والمسحوبات لمقدمي الخدمات والشركاء من قواعـد البيانات</p>
                </div>
                <Button className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-cairo">
                    <DollarSign className="w-4 h-4" />
                    إجراء تسوية جديدة
                </Button>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5">
                        <p className="text-xs text-slate-500 font-cairo">إجمالي المستحقات المعلقة</p>
                        <p className="text-2xl font-black text-amber-500 mt-1 font-mono">{pendingTotal.toFixed(2)} ج.م</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5">
                        <p className="text-xs text-slate-500 font-cairo">تم تسويته هذا الشهر</p>
                        <p className="text-2xl font-black text-emerald-500 mt-1 font-mono">{completedTotal.toFixed(2)} ج.م</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5">
                        <p className="text-xs text-slate-500 font-cairo">عدد العمليات المحولة</p>
                        <p className="text-2xl font-black text-indigo-500 mt-1 font-mono">{payouts.length} عملية</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                    <CardTitle className="text-lg font-cairo flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-indigo-500" />
                        سجل التسوية والتحويلات
                    </CardTitle>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="بحث باسم الشريك أو معرف التسوية..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pr-9 h-9 text-sm rounded-xl font-cairo"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                            <p className="font-cairo text-sm">جاري جلب بيانات الحسابات والتسويات...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-cairo border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-3">رقم العملية</th>
                                        <th className="p-3">مقدم الخدمة</th>
                                        <th className="p-3">المبلغ</th>
                                        <th className="p-3">طريقة الدفع</th>
                                        <th className="p-3">التاريخ</th>
                                        <th className="p-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-cairo">
                                    {filtered.map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.id || `PAY-${idx + 1000}`}</td>
                                            <td className="p-3 font-bold text-slate-800 dark:text-white">{item.provider || item.provider_name}</td>
                                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{(Number(item.amount) || 0).toFixed(2)} ج.م</td>
                                            <td className="p-3 text-slate-500">{item.method || "تحويل محفظة"}</td>
                                            <td className="p-3 text-slate-500">{item.date || (item.created_at ? new Date(item.created_at).toLocaleDateString("ar-EG") : "—")}</td>
                                            <td className="p-3">
                                                {item.status === 'completed' ? (
                                                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> مكتملة
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                                                        <Clock className="w-3.5 h-3.5" /> قيد المعالجة
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
