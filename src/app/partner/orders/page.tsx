"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
    ArrowRight,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    Truck,
    MapPin,
    RefreshCw,
    Plus
} from "lucide-react";

import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";
import ConfirmModal from "@/components/ui/confirm-modal";

interface Order {
    id: number;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
    created_at: string;
    courier_name?: string;
    delivery_fee?: number;
    items?: any;
}

export default function OrdersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supervisorId = searchParams.get('supervisorId');

    const [user, setUser] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled' | 'edited'>('all');

    // Status Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onCloseAction?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        setUser(JSON.parse(storedUser));
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [filter, supervisorId]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();

            // Only send 'deleted' or 'edited' to backend filtering.
            // For status groups (pending, in_transit, delivered), fetch 'all' (active orders) and filter locally.
            if (filter === 'cancelled' || filter === 'edited') {
                params.append('status', filter);
            }

            if (supervisorId) params.append('supervisorId', supervisorId);

            const queryString = params.toString();
            const endpoint = `/halan/orders${queryString ? `?${queryString}` : ''}`;

            const data = await apiCall(endpoint);

            if (data.success) {
                setOrders(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        // if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
        setConfirmModal({
            isOpen: true,
            title: 'حذف الطلب',
            message: 'هل أنت متأكد من حذف هذا الطلب نهائياً؟',
            onConfirm: () => executeDelete(id)
        });
        return;

    };

    const executeDelete = async (id: number) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
            const data = await apiCall(`/halan/orders/${id}`, {
                method: 'DELETE'
            });

            if (data.success) {
                fetchOrders(); // Refresh list
                setModalState({
                    isOpen: true,
                    title: 'تم بنجاح',
                    message: 'تم حذف الطلب بنجاح',
                    type: 'success'
                });
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: data.error || 'فشل حذف الطلب',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Delete error:', error);
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: 'حدث خطأ أثناء الحذف',
                type: 'error'
            });
        }
    };

    const handleEdit = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        router.push(`/partner/orders/edit/${id}`);
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'قيد الانتظار';
            case 'assigned': return 'تم التعيين';
            case 'ready_for_pickup': return 'تم التجهيز';
            case 'picked_up': return 'تم الاستلام';
            case 'in_transit': return 'جاري التوصيل';
            case 'delivered': return 'تم التوصيل';
            case 'cancelled': return 'ملغي';
            default: return status;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700';
            case 'assigned': return 'bg-blue-100 text-blue-700';
            case 'ready_for_pickup': return 'bg-yellow-100 text-yellow-700';
            case 'picked_up': return 'bg-indigo-100 text-indigo-700';
            case 'in_transit': return 'bg-violet-100 text-violet-700';
            case 'delivered': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return Clock;
            case 'delivered': return CheckCircle;
            case 'cancelled': return XCircle;
            default: return Truck;
        }
    };

    // Check if user is a courier
    const isCourier = user?.role === 'courier';

    // Client-side filtering for status groups
    const filteredOrders = orders.filter(order => {
        // If courier, hide delivered orders (they go to stats/history)
        if (isCourier && order.status === 'delivered') return false;

        if (filter === 'all') return true;
        if (filter === 'cancelled' || filter === 'edited') return true; // Already filtered by backend

        // Custom groupings
        if (filter === 'pending') {
            // Pending Tab: "Waiting" + "Assigned" (Driver hasn't accepted yet)
            return order.status === 'pending' || order.status === 'assigned';
        }
        if (filter === 'in_transit') {
            // In Delivery Tab: "Picked Up" + "In Transit"
            return order.status === 'picked_up' || order.status === 'in_transit';
        }
        if (filter === 'delivered') return order.status === 'delivered';

        return true;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 border-b dark:border-slate-800 sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2" title="العودة" aria-label="العودة">
                    <ArrowRight className="w-6 h-6 text-slate-800 dark:text-slate-100" />
                </button>
                <h1 className="text-xl font-bold">{isCourier ? 'طلباتي' : 'كل الطلبات'}</h1>
                <div className="mr-auto flex items-center gap-2">
                    <ThemeToggle />
                    <button
                        onClick={fetchOrders}
                        title="تحديث الطلبات"
                        aria-label="تحديث الطلبات"
                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-300 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Tabs - Hidden for couriers */}
            {!isCourier && (
                <div className="bg-white dark:bg-slate-900 p-4 shadow-sm mb-4 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {[
                            { key: 'all', label: 'الكل' },
                            { key: 'pending', label: 'قيد الانتظار' },
                            { key: 'in_transit', label: 'جاري التوصيل' },
                            { key: 'delivered', label: 'مكتمل' },
                            { key: 'edited', label: 'المعدلة' },
                            { key: 'cancelled', label: 'ملغي' },
                        ].map((s) => (
                            <button
                                key={s.key}
                                onClick={() => setFilter(s.key as any)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${filter === s.key
                                    ? 'bg-violet-600 text-white shadow-md'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="p-4 pb-24">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-16">
                        <Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 text-lg">لا توجد طلبات</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map((order, index) => {
                            const StatusIcon = getStatusIcon(order.status);
                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => router.push(`/partner/orders/${order.id}`)}
                                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
                                >
                                    {/* Edited Tag */}
                                    {(order as any).is_edited && (
                                        <div className="absolute top-0 left-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-br-lg">
                                            معدل
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <StatusIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                                    {order.customer_name} #{order.id}
                                                </span>
                                            </div>
                                            {(order as any).source === 'qareeblak' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded-full w-fit">
                                                    🌐 طلب من قريبلك
                                                </span>
                                            )}
                                            {(order as any).source && (order as any).source !== 'qareeblak' && (order as any).source !== 'manual' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-bold rounded-full w-fit">
                                                    📋 {(order as any).source}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="mb-3">
                                        <p className="font-bold text-slate-800 dark:text-slate-100">{order.customer_name}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{order.customer_phone}</p>
                                    </div>

                                    {/* Address */}
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm">
                                        <div className="flex items-start gap-2">
                                            <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-200">{order.delivery_address}</span>
                                        </div>
                                    </div>

                                    {/* Footer (Date + Actions) */}
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t dark:border-slate-700">
                                        <div className="flex flex-col items-start">
                                            <span className="text-xs text-slate-400">
                                                {new Date(order.created_at).toLocaleDateString('ar-EG')}
                                            </span>
                                            {(() => {
                                                const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                                                const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                                                const deliFee = parseFloat(order.delivery_fee?.toString() || '0');
                                                const grandTotal = itemsTotal + deliFee;

                                                if (grandTotal === 0 && deliFee === 0) return null;

                                                return (
                                                    <div className="mt-1 flex flex-col">
                                                        <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                                                            {grandTotal.toFixed(0)} ج.م
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            + {deliFee} توصيل
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Edit Only - No Delete (Orders must be completed) */}
                                            {!isCourier && filter !== 'cancelled' && (
                                                <button
                                                    onClick={(e) => handleEdit(e, order.id)}
                                                    title="تعديل"
                                                    aria-label="تعديل الطلب"
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* FAB - Create Order (for managers only) */}
            {!isCourier && (
                <button
                    onClick={() => router.push('/partner/orders/create')}
                    title="إنشاء طلب جديد"
                    aria-label="إنشاء طلب جديد"
                    className="fixed left-5 bottom-8 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg flex items-center justify-center hover:bg-violet-700 transition-colors z-50"
                >
                    <Plus className="w-7 h-7" />
                </button>
            )}

            <StatusModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="حذف نهائي"
                cancelText="إلغاء"
                isDestructive={true}
            />
        </div>
    );
}
