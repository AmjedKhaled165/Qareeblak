"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RequestsPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to main admin page with requests tab
        router.replace("/admin");
    }, [router]);

    return (
        <div className="p-10 text-center text-slate-500">
            جاري التحويل للوحة التحكم...
        </div>
    );
}
