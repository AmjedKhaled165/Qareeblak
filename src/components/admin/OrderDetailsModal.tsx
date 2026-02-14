"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    User, Store, Truck, Phone, MapPin, Package,
    Save, AlertTriangle, CheckCircle, Loader2,
    ArrowLeftRight, DollarSign, FileText, Shield, Trash2,
    Plus, Minus, RefreshCw,
} from "lucide-react";
import { adminOrdersApi, adminCouriersApi } from "@/lib/admin-api";

// ========== Types ==========
interface OrderItem {
    name: string;
    price: number;
    quantity: number;
    notes?: string;
}

interface Order {
    id: number;
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
}

interface Courier {
    id: number;
    name: string;
    name_ar?: string;
    phone?: string;
    is_available: boolean;
    active_orders?: number;
}

interface OrderDetailsModalProps {
    order: Order | null;
    open: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

// ========== Status Label Map ==========
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
    accepted: { label: "مقبول", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    preparing: { label: "قيد التحضير", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
    ready: { label: "جاهز", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
    picked_up: { label: "تم الاستلام", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
    delivering: { label: "قيد التوصيل", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
    delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    completed: { label: "مكتمل", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    cancelled: { label: "ملغي", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const ALL_STATUSES = Object.keys(STATUS_MAP);

export default function OrderDetailsModal({ order, open, onClose, onRefresh }: OrderDetailsModalProps) {
    // ===== Tabs =====
    type Tab = "details" | "edit" | "reassign" | "status";
    const [activeTab, setActiveTab] = useState<Tab>("details");

    // ===== Edit State =====
    const [editItems, setEditItems] = useState<OrderItem[]>([]);
    const [editPrice, setEditPrice] = useState(0);
    const [editDeliveryFee, setEditDeliveryFee] = useState(0);
    const [editNotes, setEditNotes] = useState("");

    // ===== Reassign State =====
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
    const [loadingCouriers, setLoadingCouriers] = useState(false);

    // ===== Status Override State =====
    const [newStatus, setNewStatus] = useState("");
    const [statusReason, setStatusReason] = useState("");

    // ===== Saving =====
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ===== Reset State When Order Changes =====
    useEffect(() => {
        if (order) {
            setEditItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
            setEditPrice(order.price || 0);
            setEditDeliveryFee(order.delivery_fee || 0);
            setEditNotes(order.notes || "");
            setNewStatus(order.status);
            setSelectedCourierId(order.courier_id || null);
            setActiveTab("details");
            setMessage(null);
        }
    }, [order]);

    // ===== Fetch Couriers For Reassign =====
    const fetchCouriers = useCallback(async () => {
        setLoadingCouriers(true);
        try {
            const data = await adminCouriersApi.getAvailable();
            setCouriers(data.couriers || []);
        } catch {
            // Fallback: empty
            setCouriers([]);
        } finally {
            setLoadingCouriers(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "reassign" && couriers.length === 0) {
            fetchCouriers();
        }
    }, [activeTab, fetchCouriers, couriers.length]);

    if (!order) return null;

    // ===== Computed =====
    const totalItemsPrice = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;

    // ===== Item Edit Helpers =====
    const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
        setEditItems((prev) => {
            const next = [...prev];
            const updated = { ...next[index], [field]: value };
            next[index] = updated;
            return next;
        });
    };

    const removeItem = (index: number) => {
        setEditItems((prev) => prev.filter((_, i) => i !== index));
    };

    const addItem = () => {
        setEditItems((prev) => [...prev, { name: "", price: 0, quantity: 1 }]);
    };

    // ===== Save Force Edit =====
    const handleSaveEdit = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await adminOrdersApi.forceEdit(order.id, {
                items: editItems,
                price: editPrice,
                delivery_fee: editDeliveryFee,
                notes: editNotes,
            });
            setMessage({ type: "success", text: "تم تحديث الطلب بنجاح ✅" });
            onRefresh();
        } catch (error: unknown) {
            setMessage({ type: "error", text: (error as Error).message || "فشل في التحديث" });
        } finally {
            setSaving(false);
        }
    };

    // ===== Save Reassign =====
    const handleReassign = async () => {
        if (!selectedCourierId) return;
        setSaving(true);
        setMessage(null);
        try {
            await adminOrdersApi.reassign(order.id, { courier_id: selectedCourierId });
            setMessage({ type: "success", text: "تم إعادة تعيين المندوب بنجاح ✅" });
            onRefresh();
        } catch (error: unknown) {
            setMessage({ type: "error", text: (error as Error).message || "فشل في إعادة التعيين" });
        } finally {
            setSaving(false);
        }
    };

    // ===== Save Status Override =====
    const handleForceStatus = async () => {
        if (!newStatus || !statusReason.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            await adminOrdersApi.forceStatus(order.id, newStatus, statusReason);
            setMessage({ type: "success", text: `تم تغيير الحالة إلى "${STATUS_MAP[newStatus]?.label}" ✅` });
            onRefresh();
        } catch (error: unknown) {
            setMessage({ type: "error", text: (error as Error).message || "فشل في تغيير الحالة" });
        } finally {
            setSaving(false);
        }
    };

    // ===== Tab Navigation =====
    const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: "details", label: "التفاصيل", icon: FileText },
        { key: "edit", label: "تعديل السعر", icon: DollarSign },
        { key: "reassign", label: "إعادة تعيين", icon: ArrowLeftRight },
        { key: "status", label: "تغيير الحالة", icon: Shield },
    ];

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
                {/* Header */}
                <div className="px-6 pt-6 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <span className="font-cairo">طلب #{order.id}</span>
                                <span className={`mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                                    {statusInfo.label}
                                </span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-1">
                            {new Date(order.created_at).toLocaleString("ar-EG", {
                                dateStyle: "medium",
                                timeStyle: "short",
                            })}
                            {order.order_type && (
                                <span className="mr-2 text-slate-400">
                                    • {order.order_type === "app" ? "طلب من التطبيق" : order.order_type === "manual" ? "طلب يدوي" : "طلب صيانة"}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab Bar */}
                    <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    activeTab === tab.key
                                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Message Banner */}
                    {message && (
                        <div
                            className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                                message.type === "success"
                                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                                    : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                            }`}
                        >
                            {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {message.text}
                        </div>
                    )}

                    {/* ======================== TAB: DETAILS ======================== */}
                    {activeTab === "details" && (
                        <div className="space-y-4">
                            {/* People Involved */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Customer */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">العميل</span>
                                    </div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{order.customer_name || "—"}</p>
                                    {order.customer_phone && (
                                        <a
                                            href={`tel:${order.customer_phone}`}
                                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:underline"
                                        >
                                            <Phone className="w-3 h-3" />
                                            {order.customer_phone}
                                        </a>
                                    )}
                                </div>

                                {/* Provider */}
                                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">مقدم الخدمة</span>
                                    </div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{order.provider_name || "—"}</p>
                                    {order.provider_phone && (
                                        <a
                                            href={`tel:${order.provider_phone}`}
                                            className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mt-1 hover:underline"
                                        >
                                            <Phone className="w-3 h-3" />
                                            {order.provider_phone}
                                        </a>
                                    )}
                                </div>

                                {/* Courier */}
                                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">المندوب</span>
                                    </div>
                                    {order.courier_name ? (
                                        <>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{order.courier_name}</p>
                                            {order.courier_phone && (
                                                <a
                                                    href={`tel:${order.courier_phone}`}
                                                    className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mt-1 hover:underline"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    {order.courier_phone}
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">غير معين</p>
                                    )}
                                </div>
                            </div>

                            {/* Addresses */}
                            {(order.pickup_address || order.delivery_address) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {order.pickup_address && (
                                        <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                            <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">عنوان الاستلام</p>
                                                <p className="text-sm text-slate-800 dark:text-white">{order.pickup_address}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order.delivery_address && (
                                        <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                            <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">عنوان التوصيل</p>
                                                <p className="text-sm text-slate-800 dark:text-white">{order.delivery_address}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Items Table */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2">المنتجات / الخدمات</h3>
                                {order.items && order.items.length > 0 ? (
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">المنتج</th>
                                                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">الكمية</th>
                                                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">السعر</th>
                                                    <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">الإجمالي</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {order.items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 text-slate-800 dark:text-white">{item.name}</td>
                                                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{item.price} ج.م</td>
                                                        <td className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-white">
                                                            {(item.price * item.quantity).toFixed(0)} ج.م
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">لا توجد عناصر</p>
                                )}
                            </div>

                            {/* Price Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">سعر المنتجات</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">{(order.price || 0).toFixed(0)} ج.م</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">رسوم التوصيل</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">{(order.delivery_fee || 0).toFixed(0)} ج.م</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between text-sm">
                                    <span className="font-bold text-slate-800 dark:text-white">الإجمالي</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                        {((order.price || 0) + (order.delivery_fee || 0)).toFixed(0)} ج.م
                                    </span>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">ملاحظات</p>
                                    <p className="text-sm text-slate-800 dark:text-white">{order.notes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================== TAB: FORCE EDIT ======================== */}
                    {activeTab === "edit" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    <strong>وضع التعديل القسري:</strong> التغييرات هنا تتجاوز قواعد التحقق العادية وتُسجّل في سجل المراقبة.
                                </p>
                            </div>

                            {/* Items Editor */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">المنتجات / الخدمات</h4>
                                    <Button variant="outline" size="sm" onClick={addItem} className="gap-1 h-7 text-xs">
                                        <Plus className="w-3 h-3" /> إضافة منتج
                                    </Button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {editItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updateItem(i, "name", e.target.value)}
                                                placeholder="اسم المنتج"
                                                className="flex-1 h-8 text-xs"
                                            />
                                            <Input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                                                className="w-20 h-8 text-xs text-center"
                                                placeholder="السعر"
                                            />
                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                                                <button
                                                    title="إنقاص الكمية"
                                                    onClick={() => updateItem(i, "quantity", Math.max(1, item.quantity - 1))}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="px-2 text-xs font-bold min-w-[24px] text-center">{item.quantity}</span>
                                                <button
                                                    title="زيادة الكمية"
                                                    onClick={() => updateItem(i, "quantity", item.quantity + 1)}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                title="حذف العنصر"
                                                onClick={() => removeItem(i)}
                                                className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 text-left">
                                    إجمالي المنتجات: <strong>{totalItemsPrice.toFixed(0)} ج.م</strong>
                                </p>
                            </div>

                            {/* Price & Delivery Fee */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">السعر الإجمالي</label>
                                    <div className="relative">
                                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="number"
                                            value={editPrice}
                                            onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                            className="pr-10 h-10"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">رسوم التوصيل</label>
                                    <div className="relative">
                                        <Truck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="number"
                                            value={editDeliveryFee}
                                            onChange={(e) => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                                            className="pr-10 h-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">ملاحظات</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="أضف ملاحظة أو سبب التعديل..."
                                />
                            </div>

                            {/* Save Button */}
                            <Button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ التعديلات
                            </Button>
                        </div>
                    )}

                    {/* ======================== TAB: REASSIGN ======================== */}
                    {activeTab === "reassign" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                <ArrowLeftRight className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                <p className="text-xs text-purple-700 dark:text-purple-300">
                                    اختر مندوب توصيل جديد. المندوب الحالي سيتلقى إشعاراً تلقائياً بالتغيير.
                                </p>
                            </div>

                            {/* Current Courier */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">المندوب الحالي</p>
                                {order.courier_name ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                            <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{order.courier_name}</p>
                                            <p className="text-xs text-slate-400">{order.courier_phone}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">لا يوجد مندوب معين</p>
                                )}
                            </div>

                            {/* Courier List */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">اختر المندوب الجديد</h4>
                                    <button
                                        onClick={fetchCouriers}
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${loadingCouriers ? "animate-spin" : ""}`} />
                                        تحديث
                                    </button>
                                </div>

                                {loadingCouriers ? (
                                    <div className="py-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                        <p className="text-xs text-slate-500">جاري تحميل المناديب...</p>
                                    </div>
                                ) : couriers.length === 0 ? (
                                    <div className="py-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <Truck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                                        <p className="text-xs text-slate-500 dark:text-slate-400">لا يوجد مناديب متاحين حالياً</p>
                                        <p className="text-[10px] text-slate-400 mt-1">تأكد أن نقاط API الإدارية تعمل</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                        {couriers.map((courier) => (
                                            <button
                                                key={courier.id}
                                                onClick={() => setSelectedCourierId(courier.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-right ${
                                                    selectedCourierId === courier.id
                                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30"
                                                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                        courier.is_available
                                                            ? "bg-green-100 dark:bg-green-900/30"
                                                            : "bg-slate-100 dark:bg-slate-800"
                                                    }`}
                                                >
                                                    <Truck
                                                        className={`w-4 h-4 ${
                                                            courier.is_available
                                                                ? "text-green-600 dark:text-green-400"
                                                                : "text-slate-400"
                                                        }`}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm text-slate-800 dark:text-white">
                                                        {courier.name_ar || courier.name}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{courier.phone}</p>
                                                </div>
                                                <div className="text-left">
                                                    <span
                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                            courier.is_available
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        {courier.is_available ? "متاح" : "مشغول"}
                                                    </span>
                                                    {courier.active_orders !== undefined && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{courier.active_orders} طلب نشط</p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Reassign Button */}
                            <Button
                                onClick={handleReassign}
                                disabled={saving || !selectedCourierId || selectedCourierId === order.courier_id}
                                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                                تأكيد إعادة التعيين
                            </Button>
                        </div>
                    )}

                    {/* ======================== TAB: STATUS OVERRIDE ======================== */}
                    {activeTab === "status" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                                <Shield className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    <strong>تغيير قسري للحالة:</strong> يتجاوز قواعد التحقق العادية. يجب كتابة سبب.
                                </p>
                            </div>

                            {/* Current Status */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">الحالة الحالية</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${statusInfo.color}`}>
                                    {statusInfo.label}
                                </span>
                            </div>

                            {/* New Status Selector */}
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">اختر الحالة الجديدة</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_STATUSES.map((s) => {
                                        const cfg = STATUS_MAP[s];
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setNewStatus(s)}
                                                disabled={s === order.status}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                                    newStatus === s && s !== order.status
                                                        ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30"
                                                        : s === order.status
                                                        ? "border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed"
                                                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`} />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                                    سبب التغيير <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={statusReason}
                                    onChange={(e) => setStatusReason(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="مثال: العميل طلب الإلغاء عبر الهاتف..."
                                />
                            </div>

                            {/* Override Button */}
                            <Button
                                onClick={handleForceStatus}
                                disabled={saving || !statusReason.trim() || newStatus === order.status}
                                className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                تأكيد تغيير الحالة القسري
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
