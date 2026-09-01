"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PartnerRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');

        if (!storedUser) {
            router.replace('/login/partner');
            return;
        }

        try {
            const user = JSON.parse(storedUser);
            const normalizedRole = String(user.role || '').replace(/^partner_/, '');

            if (normalizedRole === 'owner') {
                router.replace('/partner/owner');
            } else if (normalizedRole === 'supervisor' || normalizedRole === 'manager') {
                router.replace('/partner/manager');
            } else if (normalizedRole === 'courier' || normalizedRole === 'driver') {
                router.replace('/partner/driver');
            } else {
                router.replace('/partner/dashboard');
            }
        } catch (e) {
            router.replace('/login/partner');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-cairo" dir="rtl">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-bold">جارٍ التوجيه إلى لوحة التحكم...</p>
        </div>
    );
}
