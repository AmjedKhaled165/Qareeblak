"use client";

import { useState } from "react";
import {
    MapPin, Plus, Search, CheckCircle2, XCircle,
    Building2, Navigation, Shield, Trash2, Pencil
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/ToastProvider";

const DEFAULT_ZONES = [
    { id: 1, name: "الحي الأول - المجاورة الأولى والثانية", city: "العاشر من رمضان / المدينة", activeCouriers: 4, is_active: true },
    { id: 2, name: "الحي الثاني والثالث - مركز المدينة", city: "العاشر من رمضان / المدينة", activeCouriers: 6, is_active: true },
    { id: 3, name: "منطقة ابني بيتك - القطاع الخامس", city: "العاشر من رمضان / المدينة", activeCouriers: 3, is_active: true },
    { id: 4, name: "المنطقة الصناعية B1 و B2", city: "العاشر من رمضان / المدينة", activeCouriers: 2, is_active: true },
    { id: 5, name: "سكن الطلاب - مجاورة الجامعات", city: "العاشر من رمضان / المدينة", activeCouriers: 5, is_active: true },
];

export default function AdminZonesPage() {
    const { toast } = useToast();
    const [zones, setZones] = useState(DEFAULT_ZONES);
    const [search, setSearch] = useState("");

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <MapPin className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        التحكم الجغرافي ومناطق التغطية (Geo Zones)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        تحديد الأحياء ومناطق الخدمة وتوزيع المناديب المتاحين حسب النطاق الجغرافي
                    </p>
                </div>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm self-start">
                    <Plus className="w-4 h-4" />
                    إضافة منطقة تغطية
                </Button>
            </div>

            {/* Zones Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map((zone) => (
                    <Card key={zone.id} className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <Badge className={zone.is_active ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-red-100 text-red-800 text-[10px]"}>
                                    {zone.is_active ? "تغطية نشطة" : "متوقفة مؤقتاً"}
                                </Badge>
                            </div>

                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">{zone.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{zone.city}</p>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                                <span>المناديب النشطين: <strong className="text-slate-800 dark:text-slate-200">{zone.activeCouriers} كابتن</strong></span>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600">
                                    تعديل الحدود
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
