"use client";

import OrdersManager from "@/components/admin/OrdersManager";

export default function AdminOrdersAllPage() {
    return (
        <OrdersManager
            initialType=""
            pageTitle="مركز العمليات — جميع الطلبات"
            pageSubtitle="إدارة ومراقبة جميع طلبات المنصة والتوصيل والحجوزات في الوقت الفعلي"
        />
    );
}
