"use client";

import { useState, useEffect } from "react";
import {
    Activity, Radio, Truck, ShoppingBag, Store, Users,
    Clock, CheckCircle2, AlertTriangle, ArrowUpRight, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminLiveMonitorPage() {
    const [liveEvents, setLiveEvents] = useState([
        { id: 1, type: "order", text: "طلب جديد #1042 من مطعم البركة للعميل يوسف طارق", time: "منذ 15 ثانية", status: "pending" },
        { id: 2, type: "courier", text: "الكابتن عمر قبل توصيل طلب #1041 وجاري الاستلام", time: "منذ دقيقة", status: "delivering" },
        { id: 3, type: "delivery", text: "تم تسليم الطلب #1039 بنجاح للعميلة ندى إبراهيم", time: "منذ 3 دقائق", status: "completed" },
        { id: 4, type: "request", text: "طلب انضمام جديد من كوافير وسنتر لميس للتجميل", time: "منذ 6 دقائق", status: "request" },
    ]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Activity className="w-7 h-7 text-emerald-500 animate-pulse" />
                        رادار النشاط المباشر (Live Ops Radar)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        متابعة حركة المناديب والطلبات الحية والتحركات في الوقت الفعلي
                    </p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs px-3 py-1 flex items-center gap-1.5 self-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    البث المباشر متصل
                </Badge>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">طلبات نشطة الآن</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">8 طلبات</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">مناديب قيد التوصيل</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">5 كباتن</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600">
                            <Truck className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">مناديب متفرغين</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">7 كباتن</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                            <Zap className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">متوسط وقت التوصيل</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">22 دقيقة</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Live Feed */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        سجل العمليات والأحداث الحية (Realtime Activity Feed)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {liveEvents.map((evt) => (
                        <div key={evt.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{evt.text}</p>
                            </div>
                            <span className="text-xs text-slate-400 font-mono shrink-0">{evt.time}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
