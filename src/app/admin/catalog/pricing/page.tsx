"use client";

import { useState } from "react";
import {
    Percent, DollarSign, Truck, Save, ShieldCheck,
    AlertCircle, Sparkles, Sliders, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/ToastProvider";

export default function AdminPricingPage() {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const [pricingRules, setPricingRules] = useState({
        platformCommissionPercent: "10",
        baseDeliveryFee: "15",
        perKmDeliveryFee: "3",
        surgeMultiplier: "1.0",
        minOrderAmount: "30",
        courierSharePercent: "80",
    });

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            toast("تم حفظ قواعد التسعير والعمولات بنجاح ✅", "success");
        }, 600);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Sliders className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        التسعير، العمولات، ورسوم التوصيل
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        التحكم في نسبة عمولة المنصة وحساب تكلفة التوصيل ومستحقات المناديب
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform Commission Card */}
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Percent className="w-5 h-5 text-indigo-600" />
                            عمولة منصة قريبلك
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                نسبة عمولة المنصة من طلبات المتاجر والمقدمين (%)
                            </label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={pricingRules.platformCommissionPercent}
                                    onChange={(e) => setPricingRules({ ...pricingRules, platformCommissionPercent: e.target.value })}
                                    className="h-10 text-base font-bold font-mono pl-10"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">يتم خصم هذه النسبة تلقائياً من إجمالي الطلب قبل تحويل المستحقات للتاجر.</p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                الحد الأدنى لقيمة الطلب (ج.م)
                            </label>
                            <Input
                                type="number"
                                value={pricingRules.minOrderAmount}
                                onChange={(e) => setPricingRules({ ...pricingRules, minOrderAmount: e.target.value })}
                                className="h-10 text-base font-bold font-mono"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Fees Card */}
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Truck className="w-5 h-5 text-orange-600" />
                            حساب رسوم التوصيل والمناديب
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                رسوم التوصيل الأساسية (فتح العداد / Base Fee)
                            </label>
                            <Input
                                type="number"
                                value={pricingRules.baseDeliveryFee}
                                onChange={(e) => setPricingRules({ ...pricingRules, baseDeliveryFee: e.target.value })}
                                className="h-10 text-base font-bold font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                سعر الكيلومتر الإضافي (ج.م / كم)
                            </label>
                            <Input
                                type="number"
                                value={pricingRules.perKmDeliveryFee}
                                onChange={(e) => setPricingRules({ ...pricingRules, perKmDeliveryFee: e.target.value })}
                                className="h-10 text-base font-bold font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                نسبة المندوب من قيمة التوصيل (%)
                            </label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={pricingRules.courierSharePercent}
                                    onChange={(e) => setPricingRules({ ...pricingRules, courierSharePercent: e.target.value })}
                                    className="h-10 text-base font-bold font-mono pl-10"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
