"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import DriversMap from "@/components/partner/drivers-map";

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
    }, []);

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

            {/* Map Area */}
            <div className="flex-1 p-2">
                <DriversMap user={user} />
            </div>
        </div>
    );
}
