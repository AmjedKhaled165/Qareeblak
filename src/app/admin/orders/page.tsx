"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Package, Search, RefreshCw, Eye, Pencil, Trash2,
    ChevronLeft, ChevronRight, Clock,
    User, Store, Truck, CheckCircle,
    XCircle, Loader2, ArrowUpDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import OrderDetailsModal from "@/components/admin/OrderDetailsModal";
import { adminOrdersApi } from "@/lib/admin-api";

// ============= Types =============
interface OrderItem {
    name: string;
    price: number;
    quantity: number;
    notes?: string;
}

interface Order {
    id: number;
    display_id?: number | string;
    order_number?: string;
    customer_name: string;
    customer_phone: string;
    provider_name: string;
    provider_phone?: string;
    courier_name?: string;
    courier_phone?: string;
    courier_id?: number;
    provider_id?: number;
    status: string;
    order_type?: string;
    items: OrderItem[];
    price: number;
    delivery_fee: number;
    notes?: string;
    delivery_address?: string;
    pickup_address?: string;
    created_at: string;
    updated_at?: string;
    latitude?: number;
    longitude?: number;
}

// ============= Status Config =============
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
    accepted: { label: "مقبول", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle },
    preparing: { label: "قيد التحضير", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", icon: Package },
    ready: { label: "جاهز", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300", icon: Package },
    picked_up: { label: "تم الاستلام", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Truck },
    delivering: { label: "قيد التوصيل", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: Truck },
    delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle },
    completed: { label: "مكتمل", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle },
    cancelled: { label: "ملغي", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
    rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const ORDER_TYPES = [
    { value: "", label: "الكل" },
    { value: "app", label: "تطبيق" },
    { value: "manual", label: "يدوي" },
    { value: "maintenance", label: "صيانة" },
];

export default function OrdersPage() {
    // ===== State =====
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [sortField, setSortField] = useState<string>("created_at");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    // Filters are always visible in compact mode

    // ===== Fetch Orders =====
    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const data = await adminOrdersApi.getAll({
                page,
                limit: 25,
                status: statusFilter || undefined,
                type: typeFilter || undefined,
                search: search || undefined,
            });

            setOrders(data.orders || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalOrders(data.pagination?.total || 0);
        } catch (error: unknown) {
            console.error("Failed to fetch orders:", error);
            // Fallback: try bookings API
            try {
                const fallback = await (await import("@/lib/api")).bookingsApi.getAll();
                const bookings = fallback.bookings || fallback || [];
                setOrders(Array.isArray(bookings) ? bookings : []);
                setTotalPages(1);
                setTotalOrders(Array.isArray(bookings) ? bookings.length : 0);
            } catch {
                setOrders([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, statusFilter, typeFilter, search]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(() => fetchOrders(true), 30000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    // ===== Sorting (client-side for current page) =====
    const sortedOrders = useMemo(() => {
        return [...orders].sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[sortField];
            const bVal = (b as unknown as Record<string, unknown>)[sortField];
            if (sortDir === "asc") return String(aVal) > String(bVal) ? 1 : -1;
            return String(aVal) < String(bVal) ? 1 : -1;
        });
    }, [orders, sortField, sortDir]);

    const toggleSort = (field: string) => {
        if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    // ===== Open Order Detail Modal — fetch enriched data first =====
    const openOrderModal = async (order: Order) => {
        // Optimistically open modal with list data so it doesn't feel slow
        setSelectedOrder(order);
        setModalOpen(true);
        // Then silently enrich with full detail (delivery_address, delivery_fee, items, etc.)
        try {
            const full = await adminOrdersApi.getById(order.id);
            if (full) setSelectedOrder(full as Order);
        } catch {
            // keep the optimistic data if the detail fetch fails
        }
    };

    // ===== Quick Actions =====
    // Quick status change handled via modal

    const handleDelete = async (orderId: number) => {
        if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
        try {
            await adminOrdersApi.remove(orderId, false);
            fetchOrders(true);
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    // ===== Stats Bar =====
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        orders.forEach((o) => {
            counts[o.status] = (counts[o.status] || 0) + 1;
        });
        return counts;
    }, [orders]);

    // ===== Time Ago Helper =====
    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "الآن";
        if (mins < 60) return `${mins} دقيقة`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} ساعة`;
        const days = Math.floor(hours / 24);
        return `${days} يوم`;
    };

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">
                        📦 مركز العمليات
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        إدارة ومراقبة جميع الطلبات في الوقت الفعلي — {totalOrders} طلب
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOrders(true)}
                        disabled={refreshing}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        تحديث
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { key: "pending", label: "قيد الانتظار", bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" },
                    { key: "accepted", label: "مقبول", bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" },
                    { key: "delivering", label: "قيد التوصيل", bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" },
                    { key: "completed", label: "مكتمل", bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" },
                    { key: "cancelled", label: "ملغي", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" },
                ].map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setStatusFilter(statusFilter === s.key ? "" : s.key)}
                        className={`p-3 rounded-xl border transition-all text-right ${s.bg} ${statusFilter === s.key ? "ring-2 ring-indigo-500 scale-[1.02]" : "hover:scale-[1.01]"
                            }`}
                    >
                        <p className="text-2xl font-bold font-cairo">{statusCounts[s.key] || 0}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{s.label}</p>
                    </button>
                ))}
            </div>

            {/* Search & Filters Row */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="بحث بالاسم، الرقم، أو الهاتف..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="pr-10 h-9 text-sm rounded-lg"
                            />
                        </div>

                        {/* Type Filter */}
                        <select
                            title="نوع الطلب"
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPage(1);
                            }}
                            className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                            {ORDER_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            title="حالة الطلب"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                            <option value="">كل الحالات</option>
                            {ALL_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {STATUS_CONFIG[s].label}
                                </option>
                            ))}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">
                                    <button onClick={() => toggleSort("id")} className="flex items-center gap-1 hover:text-indigo-600">
                                        # <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">العميل</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">مقدم الخدمة</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">المندوب</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">الحالة</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">
                                    <button onClick={() => toggleSort("price")} className="flex items-center gap-1 hover:text-indigo-600">
                                        السعر <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">
                                    <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-indigo-600">
                                        الوقت <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                                        <p className="text-slate-500 dark:text-slate-400">جاري تحميل الطلبات...</p>
                                    </td>
                                </tr>
                            ) : sortedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">لا توجد طلبات</p>
                                    </td>
                                </tr>
                            ) : (
                                sortedOrders.map((order) => {
                                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                                    const StatusIcon = statusCfg.icon;

                                    return (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                                            onClick={() => openOrderModal(order)}
                                        >
                                            {/* ID */}
                                            <td className="px-3 py-2.5">
                                                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                    #{order.display_id || order.id}
                                                </span>
                                                {order.order_type && (
                                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                                        {order.order_type === "app" ? "تطبيق" : order.order_type === "manual" ? "يدوي" : "صيانة"}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Customer */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2 min-w-[140px]">
                                                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                        <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-white text-xs truncate max-w-[120px]">
                                                            {order.customer_name || "—"}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{order.customer_phone || ""}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Provider */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2 min-w-[120px]">
                                                    <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                                        <Store className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[110px]">
                                                        {order.provider_name || "—"}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* Courier */}
                                            <td className="px-3 py-2.5">
                                                {order.courier_name ? (
                                                    <div className="flex items-center gap-2 min-w-[120px]">
                                                        <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                                            <Truck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                                {order.courier_name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{order.courier_phone || ""}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">غير معين</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-3 py-2.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg.color}`}
                                                >
                                                    {(() => {
                                                        const SvgIcon = StatusIcon as any;
                                                        return <SvgIcon className="w-3 h-3" />;
                                                    })()}
                                                    {statusCfg.label}
                                                </span>
                                            </td>

                                            {/* Price */}
                                            <td className="px-3 py-2.5">
                                                <p className="font-bold text-xs text-slate-800 dark:text-white">
                                                    {(order.price || 0).toFixed(0)} ج.م
                                                </p>
                                                {order.delivery_fee > 0 && (
                                                    <p className="text-[10px] text-slate-400">+{order.delivery_fee} توصيل</p>
                                                )}
                                            </td>

                                            {/* Time */}
                                            <td className="px-3 py-2.5">
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {timeAgo(order.created_at)}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(order.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => openOrderModal(order)}
                                                        className="p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors"
                                                        title="عرض التفاصيل"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openOrderModal(order)}
                                                        className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(order.id)}
                                                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            صفحة {page} من {totalPages} — {totalOrders} طلب
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Order Details Modal */}
            <OrderDetailsModal
                order={selectedOrder}
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedOrder(null);
                }}
                onRefresh={() => fetchOrders(true)}
            />
        </div>
    );
}
