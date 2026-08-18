"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Percent, Save, Truck, Store, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";

export default function CatalogPricingPage() {
    const { toast } = useToast();
    const [commission, setCommission] = useState({
        restaurants: 12,
        pharmacies: 8,
        supermarkets: 10,
        maintenance: 15,
        baseDeliveryFee: 15,
        kmDeliveryRate: 3,
    });

    const handleSave = () => {
        toast("تم حفظ إعدادات العمولات والتسعير بنجاح ✅", "success");
    };

    return (
        <div className="space-y-6" dir="rtl">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">🏷️ التسعير والعمولات</h1>
                <p className="text-slate-500 text-sm font-cairo mt-1">تحديد نسب عمولة المنصة لكل قطاع ورسوم التوصيل الأساسية</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform Commissions */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-cairo flex items-center gap-2">
                            <Store className="w-5 h-5 text-indigo-500" />
                            عمولات القطاعات (%)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 font-cairo">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عمولة المطاعم والمأكولات (%)</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={commission.restaurants}
                                    onChange={e => setCommission({ ...commission, restaurants: Number(e.target.value) })}
                                    className="rounded-xl font-mono font-bold"
                                />
                                <Percent className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عمولة الصيدليات (%)</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={commission.pharmacies}
                                    onChange={e => setCommission({ ...commission, pharmacies: Number(e.target.value) })}
                                    className="rounded-xl font-mono font-bold"
                                />
                                <Percent className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عمولة السوبرماركت (%)</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={commission.supermarkets}
                                    onChange={e => setCommission({ ...commission, supermarkets: Number(e.target.value) })}
                                    className="rounded-xl font-mono font-bold"
                                />
                                <Percent className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عمولة الصيانة والخدمات المنزلية (%)</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={commission.maintenance}
                                    onChange={e => setCommission({ ...commission, maintenance: Number(e.target.value) })}
                                    className="rounded-xl font-mono font-bold"
                                />
                                <Percent className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Rates */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-cairo flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-500" />
                            تعريفة رسوم التوصيل
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 font-cairo">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">رسوم التوصيل الأساسية (ج.م)</label>
                            <Input
                                type="number"
                                value={commission.baseDeliveryFee}
                                onChange={e => setCommission({ ...commission, baseDeliveryFee: Number(e.target.value) })}
                                className="rounded-xl font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">تكلفة الكيلومتر الإضافي (ج.م / كم)</label>
                            <Input
                                type="number"
                                value={commission.kmDeliveryRate}
                                onChange={e => setCommission({ ...commission, kmDeliveryRate: Number(e.target.value) })}
                                className="rounded-xl font-mono font-bold"
                            />
                        </div>

                        <div className="pt-4">
                            <Button onClick={handleSave} className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                <Save className="w-4 h-4" />
                                حفظ جميع التغييرات
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
