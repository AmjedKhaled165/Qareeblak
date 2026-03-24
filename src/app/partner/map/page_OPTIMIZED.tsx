"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

// LAZY LOAD: DriversMap component contains Leaflet library (300KB+)
// Only loads when user navigates to map page, not on initial bundle
const DriversMap = lazy(() => import("@/components/partner/drivers-map"));

// Loading fallback with proper dimensions to prevent layout shift
function MapSkeleton() {
    return (
        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-2" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">جاري تحميل الخريطة...</p>
            </div>
        </div>
    );
}

export default function GlobalMapPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);
    }, [router]);

    if (!user) return null;

    return (
        <div className="h-screen w-full flex flex-col bg-slate-100 dark:bg-slate-900" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-4 shadow-sm z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <ArrowRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white">خريطة المناديب</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">تتبع مباشر لأسطول التوصيل</p>
                    </div>
                </div>
            </div>

            {/* Map Area with Suspense Boundary */}
            <div className="flex-1 p-2">
                <Suspense fallback={<MapSkeleton />}>
                    <DriversMap user={user} />
                </Suspense>
            </div>
        </div>
    );
}
