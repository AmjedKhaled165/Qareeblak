"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    Trash2
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
    items?: any[];
    notes?: string;
    is_edited?: boolean;
    edit_history?: any[];
}

interface UserOption {
    id: number;
    name: string;
    username: string;
}

// Order Details Modal Component
function OrderDetailsModal({ order, onClose }: { order: Order; onClose: () => void }) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
    const editHistory = typeof order.edit_history === 'string' ? JSON.parse(order.edit_history || '[]') : (order.edit_history || []);

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
                            <h2 className="text-lg font-bold">{order.customer_name} - طلب #{order.id}</h2>
                            {order.is_edited && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">معدل</span>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
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
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    المندوب
                                </h3>
                                <p className="text-slate-800 dark:text-slate-200 font-medium">
                                    {order.courier_name || 'غير معين'}
                                </p>
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    المسؤول
                                </h3>
                                <p className="text-slate-800 dark:text-slate-200 font-medium">
                                    {order.supervisor_name || 'غير محدد'}
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
                                <span>{(order.delivery_fee || 0).toFixed(0)} ج.م</span>
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

    const [user, setUser] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [drivers, setDrivers] = useState<UserOption[]>([]);
    const [managers, setManagers] = useState<UserOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [driverFilter, setDriverFilter] = useState<string>('all');
    const [managerFilter, setManagerFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
    }, []);

    useEffect(() => {
        if (user) {
            const timer = setTimeout(() => {
                fetchOrders();
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [user, statusFilter, driverFilter, managerFilter, searchQuery]);

    const fetchFilters = async () => {
        try {
            const usersData = await apiCall('/halan/users');
            if (usersData.success) {
                const allUsers = usersData.data;
                setDrivers(allUsers.filter((u: any) => u.role === 'courier'));
                setManagers(allUsers.filter((u: any) => u.role === 'supervisor'));
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (driverFilter !== 'all') params.append('courierId', driverFilter);
            if (managerFilter !== 'all') params.append('supervisorId', managerFilter);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const queryString = params.toString();
            const endpoint = `/halan/orders${queryString ? `?${queryString}` : ''}`;

            const data = await apiCall(endpoint);
            if (data.success) {
                setOrders(data.data || []);
            } else {
                setOrders([]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'قيد الانتظار';
            case 'assigned': return 'تم التعيين';
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 pt-8 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()} className="p-2 bg-white/20 rounded-full">
                        <ArrowRight className="w-5 h-5 text-white" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white">كل الطلبات</h1>
                        <p className="text-white/80 text-sm">{orders.length} طلب</p>
                    </div>
                    <button
                        onClick={fetchOrders}
                        className="mr-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 pr-11 pl-4 text-sm outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">تصفية النتائج</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="all">كل الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="in_transit">جاري التوصيل</option>
                            <option value="delivered">مكتملة</option>
                            <option value="cancelled">ملغي</option>
                            <option value="edited">المعدلة</option>
                            <option value="deleted">المحذوفة</option>
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Driver Filter */}
                    <div className="relative">
                        <select
                            value={driverFilter}
                            onChange={(e) => setDriverFilter(e.target.value)}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
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
                            onChange={(e) => setManagerFilter(e.target.value)}
                            className="w-full appearance-none bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="all">كل المسؤولين</option>
                            {managers.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Orders List */}
            <div className="p-4 pb-8">
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
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={() => setSelectedOrder(order)}
                                    className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all relative overflow-hidden"
                                >
                                    {/* Edited Badge */}
                                    {order.is_edited && (
                                        <div className="absolute top-0 left-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-br-lg">
                                            معدل
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <StatusIcon className="w-4 h-4 text-slate-500" />
                                            <span className="font-bold text-slate-800 dark:text-slate-100">
                                                {order.customer_name} #{order.id}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusStyle(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>

                                    {/* Customer */}
                                    <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{order.customer_name}</p>

                                    {/* Driver & Manager */}
                                    <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        <span className="flex items-center gap-1">
                                            <Truck className="w-3 h-3" />
                                            {order.courier_name || 'غير معين'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <UserCheck className="w-3 h-3" />
                                            {order.supervisor_name || 'غير محدد'}
                                        </span>
                                    </div>

                                    {/* Address */}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        <MapPin className="w-3 h-3 text-green-500" />
                                        <span className="truncate">{order.delivery_address}</span>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <span className="text-xs text-slate-400">
                                            {new Date(order.created_at).toLocaleDateString('ar-EG')}
                                        </span>
                                        <div className="text-left">
                                            {(() => {
                                                const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                                                const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                                                const deliFee = parseFloat(order.delivery_fee?.toString() || '0');
                                                const grandTotal = itemsTotal + deliFee;

                                                return (
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                                                            {grandTotal.toFixed(0)} ج.م
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                            + {deliFee} توصيل
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
}
