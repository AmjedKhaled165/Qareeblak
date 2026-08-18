"use client";

import OrdersManager from "@/components/admin/OrdersManager";

export default function AdminDeliveryOrdersPage() {
    return (
        <OrdersManager
            initialType="manual"
            pageTitle="طلبات التوصيل السريع والمناديب"
            pageSubtitle="إدارة وتتبع طلبات التوصيل الفوري وإسناد الكباتن"
        />
    );
}
