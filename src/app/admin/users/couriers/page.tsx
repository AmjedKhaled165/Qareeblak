"use client";

import UserManager from "@/components/admin/UserManager";

export default function AdminCouriersPage() {
    return (
        <UserManager
            initialTab="partner_courier"
            pageTitle="إدارة كباتن ومناديب التوصيل"
            pageSubtitle="متابعة أسطول المناديب، حالات التوفر الحالية، وسجلات النشاط"
        />
    );
}
