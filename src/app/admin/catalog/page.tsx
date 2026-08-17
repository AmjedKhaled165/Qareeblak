"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminCatalogPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/catalog/categories");
    }, [router]);
    return null;
}
