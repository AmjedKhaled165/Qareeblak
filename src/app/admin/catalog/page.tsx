"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CatalogRootPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/catalog/categories");
    }, [router]);

    return (
        <div className="p-10 text-center text-slate-500 font-cairo">
            جاري التحويل لكتالوج التصنيفات...
        </div>
    );
}
