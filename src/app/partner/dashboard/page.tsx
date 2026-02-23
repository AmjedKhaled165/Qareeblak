"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');

        if (!storedUser) {
            router.replace('/login/partner');
            return;
        }

        const user = JSON.parse(storedUser);

        // Redirect based on role
        if (user.role === 'owner') {
            router.replace('/partner/owner');
        } else if (user.role === 'supervisor') {
            router.replace('/partner/manager');
        } else if (user.role === 'courier') {
            router.replace('/partner/driver');
        } else {
            // Default to manager if role unknown
            router.replace('/partner/manager');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-[100px] z-0" />

            <div className="text-center relative z-10">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-xl shadow-primary/20" />
                <p className="text-foreground text-lg font-bold font-cairo">جارٍ التحويل...</p>
                <p className="text-muted-foreground text-sm mt-2 font-cairo">من فضلك انتظر لحظة</p>
            </div>
        </div>
    );
}
