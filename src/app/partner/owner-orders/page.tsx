"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    Truck,
    MapPin,
    Phone,
    RefreshCw,
    Filter,
    X,
    User,
    UserCheck,
    Calendar,
    Edit3,
    ShoppingBag,
    ChevronDown,
    Search,
    Trash2,
    Globe,
    ChevronLeft,
    ChevronRight
} from "lucide-react";

import { apiCall } from "@/lib/api";

interface Order {
    id: number;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
    created_at: string;
    delivered_at?: string;
    courier_id?: number;
    courier_name?: string;
    supervisor_id?: number;
    supervisor_name?: string;
    delivery_fee?: number;
    total_price?: number;
    items?: any;
    notes?: string;
    is_edited?: boolean;
    edit_history?: any;
    source?: string; // 'qareeblak', 'manual', 'whatsapp', 'maintenance', etc.
}

interface UserOption {
    id: number;
    name: string;
    username: string;
    supervisorIds?: number[];
    isAvailable?: boolean;
}

const normalizeSourceKey = (source?: string) => {
    const value = String(source || '').toLowerCase();
    if (value.includes('qareeblak')) return 'qareeblak';
    if (value.includes('whatsapp') || value.includes('واتس') || value.includes('وتس')) return 'whatsapp';
    if (value.includes('maintenance') || value.includes('صيانة')) return 'maintenance';
    if (value.includes('manual') || value.includes('يدوي')) return 'manual';
    return value || 'unknown';
};

const mapSourceLabel = (source: string | undefined) => {
    const normalized = normalizeSourceKey(source);
    switch (normalized) {
        case 'qareeblak': return 'قريبلك';
        case 'manual': return 'يدوي';
        case 'whatsapp': return 'وتس';
        case 'maintenance': return 'صيانة';
        default: return source || 'غير محدد';
    }
};

// Order Details Modal Component
function OrderDetailsModal({ order, drivers, managers, onClose, onUpdateOrder }: { order: Order; drivers: UserOption[]; managers: UserOption[]; onClose: () => void; onUpdateOrder: (id: number, payload: any) => Promise<void> }) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
    const editHistory = typeof order.edit_history === 'string' ? JSON.parse(order.edit_history || '[]') : (order.edit_history || []);

    const getSourceLabel = (source: string | undefined) => mapSourceLabel(source);

    const getSourceColor = (source: string | undefined) => {
        switch (normalizeSourceKey(source)) {
            case 'qareeblak': return 'text-emerald-700 dark:text-emerald-400';
            case 'manual': return 'text-blue-700 dark:text-blue-400';
            case 'whatsapp': return 'text-green-700 dark:text-green-400';
            case 'maintenance': return 'text-orange-700 dark:text-orange-400';
            default: return 'text-slate-700 dark:text-slate-400';
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center z-10">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold">{order.customer_name} - طلب #{order.id}</h2>
                                {order.is_edited && (
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">معدل</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs font-bold text-slate-500">المصدر:</span>
                                <select 
                                    className={`text-xs font-bold rounded-lg px-2 py-1 outline-none border border-slate-200 dark:border-slate-700 ${getSourceColor(order.source)} bg-white dark:bg-slate-800`}
                                    value={order.source || ''}
                                    onChange={(e) => onUpdateOrder(order.id, { source: e.target.value })}
                                    title="تحديث مصدر الطلب"
                                    aria-label="تحديث مصدر الطلب"
                                >
                                    <option value="qareeblak">قريبلك</option>
                                    <option value="manual">يدوي</option>
                                    <option value="whatsapp">وتس</option>
                                    <option value="maintenance">صيانة</option>
                                </select>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full" title="إغلاق التنبيه" aria-label="إغلاق نافذة تفاصيل الطلب">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Customer Info */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                بيانات العميل
                            </h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-600 dark:text-slate-400 text-sm">الاسم:</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">{order.customer_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <a href={`tel:${order.customer_phone}`} className="text-blue-600 dark:text-blue-400">
                                        {order.customer_phone}
                                    </a>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-green-500 mt-1" />
                                    <span className="text-slate-700 dark:text-slate-300 text-sm">{order.delivery_address}</span>
                                </div>
                            </div>
                        </div>

                        {/* Driver & Manager Info */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    المندوب
                                </h3>
                                <select 
                                    className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 text-sm font-medium border border-violet-200 dark:border-violet-700 outline-none focus:ring-2 focus:ring-violet-500"
                                    value={order.courier_id || ''}
                                    onChange={(e) => onUpdateOrder(order.id, { courier_id: e.target.value || null })}
                                    title="تعيين المندوب"
                                    aria-label="تعيين المندوب"
                                >
                                    <option value="">غير معين</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    المسؤول
                                </h3>
                                <select 
                                    className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 text-sm font-medium border border-indigo-200 dark:border-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={order.supervisor_id || ''}
                                    onChange={(e) => onUpdateOrder(order.id, { supervisor_id: e.target.value || null })}
                                    title="تعيين المسؤول"
                                    aria-label="تعيين المسؤول"
                                >
                                    <option value="">غير محدد</option>
                                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    المصدر
                                </h3>
                                <p className="text-slate-800 dark:text-slate-200 font-medium text-sm">
                                    {getSourceLabel(order.source)}
                                </p>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4" />
                                المنتجات ({items.length})
                            </h3>
                            <div className="space-y-2">
                                {items.length > 0 ? items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{item.name || item.product_name || 'منتج'}</p>
                                            <p className="text-xs text-slate-500">الكمية: {item.quantity || 1}</p>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">
                                            {(item.price || item.unit_price || 0)} ج.م
                                        </p>
                                    </div>
                                )) : (
                                    <p className="text-slate-500 text-center py-2">لا توجد منتجات مسجلة</p>
                                )}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                            <div className="flex justify-between items-center mb-1 text-sm opacity-90">
                                <span>مجموع المنتجات</span>
                                <span>{items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0).toFixed(0)} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center mb-2 text-sm opacity-90">
                                <span>رسوم التوصيل</span>
                                <span>{(Number(order.delivery_fee) || 0).toFixed(0)} ج.م</span>
                            </div>
                            <div className="border-t border-white/30 pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg">الإجمالي</span>
                                    <span className="font-bold text-lg">
                                        {(items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0) + parseFloat(order.delivery_fee?.toString() || '0')).toFixed(0)} ج.م
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                التواريخ
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">تاريخ الإنشاء:</span>
                                    <span className="text-slate-800 dark:text-slate-200">
                                        {new Date(order.created_at).toLocaleString('ar-EG')}
                                    </span>
                                </div>
                                {order.delivered_at && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">تاريخ التسليم:</span>
                                        <span className="text-green-600 dark:text-green-400">
                                            {new Date(order.delivered_at).toLocaleString('ar-EG')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400 mb-2">ملاحظات</h3>
                                <p className="text-slate-700 dark:text-slate-300 text-sm">{order.notes}</p>
                            </div>
                        )}

                        {/* Edit History */}
                        {editHistory.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-sm text-yellow-600 dark:text-yellow-400 mb-3 flex items-center gap-2">
                                    <Edit3 className="w-4 h-4" />
                                    سجل التعديلات ({editHistory.length})
                                </h3>
                                <div className="space-y-3 max-h-40 overflow-y-auto">
                                    {editHistory.map((edit: any, idx: number) => (
                                        <div key={idx} className="border-r-2 border-yellow-400 pr-3 py-1">
                                            <p className="text-xs text-slate-500">{new Date(edit.timestamp || edit.edited_at).toLocaleString('ar-EG')}</p>
                                            <p className="text-sm text-slate-700 dark:text-slate-300">{edit.change || edit.description || 'تم التعديل'}</p>
                                            {edit.edited_by && <p className="text-xs text-slate-400">بواسطة: {edit.edited_by}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default function OwnerAllOrdersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [user, setUser] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [drivers, setDrivers] = useState<UserOption[]>([]);
    const [managers, setManagers] = useState<UserOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const LIMIT = 50;

    // Filters - read initial values from URL params
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
    const [driverFilter, setDriverFilter] = useState<string>(searchParams.get('courierId') || 'all');
    const [managerFilter, setManagerFilter] = useState<string>(searchParams.get('supervisorId') || 'all');
    const [sourceFilter, setSourceFilter] = useState<string>(searchParams.get('source') || 'all');
    const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Keep latest fetchOrders for socket callbacks without re-registering listeners each render.
    const fetchOrdersRef = useRef<() => Promise<void>>(async () => { });

    const fetchFilters = useCallback(async () => {
        try {
            const usersData = await apiCall('/halan/users');
            if (usersData.success) {
                const allUsers = usersData.data;
                setDrivers(allUsers.filter((u: any) => u.role === 'courier'));
                setManagers(allUsers.filter((u: any) => u.role === 'supervisor'));
            }
        } catch (error: any) {
            const message = String(error?.message || '');
            if (message.includes('نشاط غير طبيعي')) {
                console.warn('Filters request was rate limited.');
                return;
            }
            console.error('Error fetching filters:', error);
        }
    }, []);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (driverFilter !== 'all') params.append('courierId', driverFilter);
            if (managerFilter !== 'all') params.append('supervisorId', managerFilter);
            if (sourceFilter !== 'all') params.append('source', sourceFilter);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            // Pagination params
            params.append('page', page.toString());
            params.append('limit', LIMIT.toString());

            const queryString = params.toString();
            const endpoint = `/halan/orders${queryString ? `?${queryString}` : ''}`;

            const data = await apiCall(endpoint);
            if (data.success) {
                setOrders(data.data || []);
                // Handle pagination metadata if returned by backend
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages);
                    setTotalOrders(data.pagination.total);
                }
            } else {
                setOrders([]);
            }
        } catch (error: any) {
            const message = String(error?.message || '');
            if (message.includes('نشاط غير طبيعي')) {
                console.warn('Orders request was rate limited.');
                setOrders([]);
            } else {
                console.error('Error fetching orders:', error);
            }
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, driverFilter, managerFilter, sourceFilter, searchQuery, page]);

    useEffect(() => {
        fetchOrdersRef.current = fetchOrders;
    }, [fetchOrders]);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const userData = JSON.parse(storedUser);
        if (userData.role !== 'owner') {
            router.push('/partner/orders');
            return;
        }
        setUser(userData);
        fetchFilters();

        // Real-time updates
        const socket = (window as any).__qareeblak_socket;
        if (socket) {
            console.log('[OwnerDashboard] 📡 Attaching real-time listeners');

            const handleUpdate = () => {
                console.log('[OwnerDashboard] 🔄 Triggering refresh from socket event');
                fetchOrdersRef.current();
            };

            socket.on('booking-updated', handleUpdate);
            socket.on('order-status-changed', handleUpdate);
            socket.on('order-updated', handleUpdate);

            return () => {
                socket.off('booking-updated', handleUpdate);
                socket.off('order-status-changed', handleUpdate);
                socket.off('order-updated', handleUpdate);
            };
        }
    }, [router, fetchFilters]);

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user, fetchOrders]); // Re-fetch on page/filter changes via memoized callback

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
            case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'assigned': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'ready_for_pickup': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'delivered': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
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

    const getSourceLabel = (source: string | undefined) => {
        return mapSourceLabel(source);
    };

    const getSourceColor = (source: string | undefined) => {
        switch (normalizeSourceKey(source)) {
            case 'qareeblak': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'manual': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'whatsapp': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'maintenance': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const handleUpdateOrder = async (id: number, payload: any) => {
        try {
            if (Object.prototype.hasOwnProperty.call(payload, 'courier_id')) {
                const courierId = Number(payload.courier_id);
                if (!Number.isInteger(courierId) || courierId <= 0) {
                    return;
                }
                await apiCall(`/halan/orders/${id}/assign-courier`, {
                    method: 'PATCH',
                    body: JSON.stringify({ courierId })
                });
            } else {
                const metaPayload: any = { ...payload };
                if (Object.prototype.hasOwnProperty.call(metaPayload, 'supervisor_id')) {
                    metaPayload.supervisor_id = metaPayload.supervisor_id ? Number(metaPayload.supervisor_id) : null;
                }
                await apiCall(`/halan/orders/${id}/meta`, {
                    method: 'PATCH',
                    body: JSON.stringify(metaPayload)
                });
            }
            
            // Update modal state so user sees change immediately
            if (selectedOrder && selectedOrder.id === id) {
                const updatedOrder = { ...selectedOrder, ...payload };
                if (payload.courier_id !== undefined) {
                    updatedOrder.courier_name = drivers.find(d => d.id == payload.courier_id)?.name || null;
                }
                if (payload.supervisor_id !== undefined) {
                    updatedOrder.supervisor_name = managers.find(m => m.id == payload.supervisor_id)?.name || null;
                }
                setSelectedOrder(updatedOrder);
            }
            
            // Refresh list in background
            fetchOrders();
        } catch (e) {
            console.error('Failed to update order', e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 pt-8 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()} className="p-2 bg-white/20 rounded-full" aria-label="رجوع">
                        <ArrowRight className="w-5 h-5 text-white" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white">كل الطلبات</h1>
                        <p className="text-white/80 text-sm">
                            {isLoading ? 'جاري التحميل...' : totalOrders > 0 ? `إجمالي ${totalOrders} طلب` : 'لا توجد طلبات'}
                        </p>
                    </div>
                    <button
                        onClick={fetchOrders}
                        className="mr-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                        aria-label="تحديث القائمة"
                    >
                        <RefreshCw className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 shadow-md -mt-2 rounded-t-3xl space-y-4">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="ابحث عن: اسم، موبايل، منتج، عنوان، سعر..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 pr-11 pl-4 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setPage(1); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                            aria-label="مسح البحث"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">تصفية النتائج</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            aria-label="تصفية حسب الحالة"
                        >
                            <option value="all">كل الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="ready_for_pickup">تم التجهيز</option>
                            <option value="in_transit">جاري التوصيل</option>
                            <option value="delivered">مكتملة</option>
                            <option value="cancelled">ملغي</option>
                            <option value="edited">المعدلة</option>
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Driver Filter */}
                    <div className="relative">
                        <select
                            value={driverFilter}
                            onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            aria-label="تصفية حسب المندوب"
                        >
                            <option value="all">كل المناديب</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Manager Filter */}
                    <div className="relative">
                        <select
                            value={managerFilter}
                            onChange={(e) => { setManagerFilter(e.target.value); setPage(1); }}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            aria-label="تصفية حسب المسؤول"
                        >
                            <option value="all">كل المسؤولين</option>
                            {managers.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Source Filter */}
                    <div className="relative">
                        <select
                            value={sourceFilter}
                            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            aria-label="تصفية حسب المصدر"
                        >
                            <option value="all">كل المصادر</option>
                            <option value="qareeblak">قريبلك</option>
                            <option value="manual">يدوي</option>
                            <option value="whatsapp">وتس</option>
                            <option value="maintenance">صيانة</option>
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Orders List - Unified */}
            <div className="p-4 pb-20">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-16">
                        <Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 text-lg">لا توجد طلبات</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order, index) => {
                            const StatusIcon = getStatusIcon(order.status);
                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={() => setSelectedOrder(order)}
                                    className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all border border-slate-100 dark:border-slate-700 relative overflow-hidden"
                                >
                                    {/* Source Indicator Strip */}
                                    <div className={`absolute top-0 right-0 bottom-0 w-1 ${normalizeSourceKey(order.source) === 'qareeblak' ? 'bg-emerald-500' : normalizeSourceKey(order.source) === 'manual' ? 'bg-blue-500' : normalizeSourceKey(order.source) === 'whatsapp' ? 'bg-green-500' : 'bg-slate-300'}`} />

                                    {/* Edited Badge */}
                                    {order.is_edited && (
                                        <div className="absolute top-3 left-3 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                                            معدل
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-3 pr-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <StatusIcon className="w-4 h-4 text-slate-500" />
                                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                                    {order.customer_name} #{order.id}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getSourceColor(order.source)}`}>
                                                    {getSourceLabel(order.source)}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyle(order.status)}`}>
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Phone */}
                                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-1 flex items-center gap-1 pr-3">
                                        <Phone className="w-3 h-3" />
                                        {order.customer_phone}
                                    </p>

                                    {/* Info Row */}
                                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2 pr-3">
                                        <span className="flex items-center gap-1">
                                            <Truck className="w-3 h-3" />
                                            {order.courier_name || 'غير معين'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate max-w-[150px]">{order.delivery_address}</span>
                                        </span>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700 pr-3">
                                        <span className="text-xs text-slate-400">
                                            {new Date(order.created_at).toLocaleDateString('ar-EG')}
                                        </span>

                                        {(() => {
                                            const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                                            const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                                            const deliFee = parseFloat(order.delivery_fee?.toString() || '0');
                                            const grandTotal = itemsTotal + deliFee;

                                            return (
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                    {grandTotal.toFixed(0)} ج.م
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {!isLoading && orders.length > 0 && (
                    <div className="flex justify-center items-center gap-4 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            title="الصفحة السابقة"
                            aria-label="الصفحة السابقة"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            صفحة {page} من {totalPages}
                        </span>

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            title="الصفحة التالية"
                            aria-label="الصفحة التالية"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    drivers={drivers}
                    managers={managers}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateOrder={handleUpdateOrder}
                />
            )}
        </div>
    );
}
