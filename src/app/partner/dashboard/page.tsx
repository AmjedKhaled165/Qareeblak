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
        <div className="min-h-screen bg-slate-100 flex items-center justify-center" dir="rtl">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600">جارٍ التحويل...</p>
            </div>
        </div>
    );
}
