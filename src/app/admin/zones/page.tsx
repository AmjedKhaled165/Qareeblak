"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Plus, CheckCircle2, Navigation, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ZonesPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const mockZones = [
        { id: 1, name: "منطقة وسط البلد / القاهرة", code: "CAI-CTR", status: true, activeCouriers: 12, activeStores: 45 },
        { id: 2, name: "منطقة المعادي والتجمع", code: "CAI-EAS", status: true, activeCouriers: 18, activeStores: 62 },
        { id: 3, name: "منطقة الشيخ زايد و6 أكتوبر", code: "GZA-WST", status: true, activeCouriers: 14, activeStores: 38 },
        { id: 4, name: "منطقة الإسكندرية - سموحة", code: "ALX-SMH", status: true, activeCouriers: 8, activeStores: 20 },
    ];

    const filtered = mockZones.filter(z => z.name.includes(searchTerm) || z.code.includes(searchTerm));

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">🌍 التحكم الجغرافي والمناطق</h1>
                    <p className="text-slate-500 text-sm font-cairo mt-1">تحديد نطاقات الخدمة ومناطق التغطية الجغرافية والتوصيل</p>
                </div>
                <Button className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4" />
                    إضافة منطقة جديدة
                </Button>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                    <CardTitle className="text-lg font-cairo flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-indigo-500" />
                        مناطق التغطية الفعالة
                    </CardTitle>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="بحث بكود أو اسم المنطقة..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pr-9 h-9 text-sm rounded-xl"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((zone) => (
                            <div key={zone.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                            <Navigation className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white font-cairo text-base">{zone.name}</h3>
                                            <span className="text-xs font-mono text-slate-400">{zone.code}</span>
                                        </div>
                                    </div>
                                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> مغطاة
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 font-cairo pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <span>المناديب النشطين: <strong className="text-slate-800 dark:text-slate-200 font-mono">{zone.activeCouriers}</strong></span>
                                    <span>•</span>
                                    <span>المتاجر المغطاة: <strong className="text-slate-800 dark:text-slate-200 font-mono">{zone.activeStores}</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
