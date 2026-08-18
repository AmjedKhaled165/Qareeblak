"use client";

import UserManager from "@/components/admin/UserManager";

export default function AdminUsersRootPage() {
    return (
        <UserManager
            initialTab="customer"
            pageTitle="إدارة المستخدمين الشاملة"
            pageSubtitle="التحكم في كافة حسابات العملاء ومقدمي الخدمات والمناديب والمسؤولين"
        />
    );
}
