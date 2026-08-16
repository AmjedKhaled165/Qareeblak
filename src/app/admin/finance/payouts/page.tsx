"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    ScrollText, Plus, RefreshCw, CheckCircle2, Clock,
    DollarSign, ArrowUpRight, Store, CreditCard, Search,
    Download, AlertCircle, FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface PayoutItem {
    id: number;
    provider_id: number | string;
    provider_name?: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    status: string;
    created_at: string;
    admin_name?: string;
    notes?: string;
}

export default function AdminPayoutsPage() {
    const { toast } = useToast();
    const [payouts, setPayouts] = useState<PayoutItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // New Payout Form Data
    const [formData, setFormData] = useState({
        providerId: "",
        amount: "",
        method: "vodafone_cash",
        reference: "",
        notes: "",
    });

    const loadPayouts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiCall<any>("/admin/finance/payouts");
            const list = res?.data || res || [];
            setPayouts(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error("Failed to load payouts:", error);
            // Provide fallback sample data if backend endpoint is empty
            setPayouts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPayouts();
    }, [loadPayouts]);

    const handleCreatePayout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.providerId || !formData.amount) {
            toast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        setSaving(true);
        try {
            await apiCall("/admin/finance/payouts", {
                method: "POST",
                body: JSON.stringify({
                    providerId: formData.providerId,
                    amount: parseFloat(formData.amount),
                    method: formData.method,
                    reference: formData.reference,
                    notes: formData.notes,
                }),
            });

            toast("تم تسجيل عملية التسوية بنجاح ✅", "success");
            setModalOpen(false);
            setFormData({ providerId: "", amount: "", method: "vodafone_cash", reference: "", notes: "" });
            loadPayouts();
        } catch (error: any) {
            toast(error.message || "فشل تسجيل التسوية", "error");
        } finally {
            setSaving(false);
        }
    };

    const totalPayoutsAmount = payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const filteredPayouts = payouts.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (p.provider_name && p.provider_name.toLowerCase().includes(q)) ||
            (p.reference_number && p.reference_number.toLowerCase().includes(q)) ||
            (p.payment_method && p.payment_method.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <ScrollText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        تسوية حسابات مقدمي الخدمات (Payouts)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        إدارة وصرف مستحقات التجار ومقدمي الخدمات والمناديب وتوثيق أرقام التحويل
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={loadPayouts}
                        disabled={loading}
                        className="gap-2 border-slate-200 dark:border-slate-800"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        تحديث
                    </Button>
                    <Button
                        onClick={() => setModalOpen(true)}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        تسجيل تسوية جديدة
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">إجمالي المبالغ المسواة</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {totalPayoutsAmount.toLocaleString("ar-EG")} ج.م
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">عدد التحويلات المكتملة</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {payouts.length} عملية
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">طرق الدفع الأكثر استخداماً</p>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                فودافون كاش / إنستاباي
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <CreditCard className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="بحث باسم مقدم الخدمة أو رقم الحوالة أو طريقة الدفع..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300"># الحوالة</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">مقدم الخدمة</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">المبلغ</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">طريقة التحويل</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الرقم المرجعي (Ref)</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">التاريخ</th>
                                <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        جاري تحميل سجل التسويات...
                                    </td>
                                </tr>
                            ) : filteredPayouts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400">
                                        <ScrollText className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                        لا توجد تسويات مسجلة حالياً
                                    </td>
                                </tr>
                            ) : (
                                filteredPayouts.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">#{item.id}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                            {item.provider_name || `مقدم خدمة #${item.provider_id}`}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                                            {Number(item.amount).toLocaleString("ar-EG")} ج.م
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                            {item.payment_method === "vodafone_cash" ? "فودافون كاش" :
                                             item.payment_method === "instapay" ? "إنستاباي" :
                                             item.payment_method === "bank_transfer" ? "تحويل بنكي" : "نقدي"}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                            {item.reference_number || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {new Date(item.created_at).toLocaleDateString("ar-EG")}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                                                مكتملة ✅
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Payout Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-emerald-600" />
                            تسجيل تسوية وصرف مستحقات
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            تسجيل عملية دفع أو تحويل لمقدم خدمة وتحديث السجل المالي
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreatePayout} className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                معرف أو كود مقدم الخدمة (Provider ID) *
                            </label>
                            <Input
                                required
                                placeholder="مثال: 12 أو PRV_..."
                                value={formData.providerId}
                                onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                المبلغ المسدد (بالجنيه المصري) *
                            </label>
                            <Input
                                required
                                type="number"
                                step="0.01"
                                placeholder="مثال: 1500"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                طريقة التحويل *
                            </label>
                            <select
                                value={formData.method}
                                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            >
                                <option value="vodafone_cash">محفظة إلكترونية (فودافون كاش / اتصالات / أورنج)</option>
                                <option value="instapay">إنستاباي (InstaPay)</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="cash">تسليم نقدي مباشر</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                الرقم المرجعي للحوالة / كود المعاملة
                            </label>
                            <Input
                                placeholder="رقم الإشعار أو المعاملة من تطبيق البنك/المحفظة"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                {saving ? "جاري التسجيل..." : "تأكيد وتسجيل الحوالة"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
