"use client";

import { useCourierTracking } from "@/components/providers/CourierTrackingProvider";
import { MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";

export function TrackingGuard({ children }: { children: React.ReactNode }) {
    const { isTracking, isExpired, userRole, startTracking } = useCourierTracking();
    const [isActivating, setIsActivating] = useState(false);

    // Only block couriers
    if (userRole !== 'courier') return <>{children}</>;

    // If tracking is active and not expired, just show children
    if (isTracking && !isExpired) return <>{children}</>;

    // Show activation overlay
    const handleActivate = async () => {
        setIsActivating(true);
        await startTracking();
        setIsActivating(false);
    };

    return (
        <div className="relative min-h-screen">
            <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
                    <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <MapPin className="w-10 h-10 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 text-right">
                        تنشيط الموقع مطلوب
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-right">
                        لبدء العمل واستخدام التطبيق، يجب عليك تنشيط خدمة الموقع.
                        سيظل التتبع نشطاً لمدة 24 ساعة لضمان استلام الطلبات حتى لو أغلقت التطبيق.
                    </p>
                    <button
                        onClick={handleActivate}
                        disabled={isActivating}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg hover:shadow-violet-500/30 active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isActivating ? (
                            <>
                                <RefreshCw className="w-6 h-6 animate-spin" />
                                جارٍ التفعيل...
                            </>
                        ) : (
                            <>
                                <MapPin className="w-6 h-6" />
                                تنشيط الموقع وبدء العمل
                            </>
                        )}
                    </button>
                    <p className="mt-4 text-xs text-slate-400 text-center">
                        لا يمكن استخدام التطبيق بدون تفعيل الموقع
                    </p>
                </div>
            </div>
            {/* Partially blur the background children just in case */}
            <div className="blur-sm pointer-events-none">
                {children}
            </div>
        </div>
    );
}
