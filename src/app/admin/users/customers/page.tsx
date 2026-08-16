"use client";

import UserManager from "@/components/admin/UserManager";

export default function AdminCustomersPage() {
    return (
        <UserManager
            initialTab="customer"
            pageTitle="إدارة العملاء والمستخدمين"
            pageSubtitle="عرض وتعديل ومتابعة حسابات عملاء منصة قريبلك"
        />
    );
}
