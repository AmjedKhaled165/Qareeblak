"use client";

import UserManager from "@/components/admin/UserManager";

export default function AdminProvidersPage() {
    return (
        <UserManager
            initialTab="provider"
            pageTitle="إدارة مقدمي الخدمات والتجار"
            pageSubtitle="عرض ومتابعة حسابات المتاجر، المطاعم، الصيدليات، والحرفيين"
        />
    );
}
