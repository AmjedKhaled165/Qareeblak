"use client";

import OrdersManager from "@/components/admin/OrdersManager";

export default function AdminMaintenanceOrdersPage() {
    return (
        <OrdersManager
            initialType="maintenance"
            pageTitle="طلبات الصيانة والخدمات الحرفية"
            pageSubtitle="إدارة طلبات وحجوزات السباكة، الكهرباء، التكييف، والصيانة المنزلية"
        />
    );
}
