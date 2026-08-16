"use client";

import UserManager from "@/components/admin/UserManager";

export default function AdminAdminsPage() {
    return (
        <UserManager
            initialTab="admin"
            pageTitle="إدارة المشرفين والمسؤولين"
            pageSubtitle="التحكم في حسابات الإدارة وصلاحيات التشغيل والدعم الفني"
        />
    );
}
