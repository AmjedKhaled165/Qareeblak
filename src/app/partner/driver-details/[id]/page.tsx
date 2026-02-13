"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    DollarSign,
    Package,
    CheckCircle,
    Clock,
    Phone,
    MapPin,
    ShoppingBag,
    X,
    User,
    Calendar
} from "lucide-react";
import { apiCall } from "@/lib/api";

interface Order {
    id: number;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    status: string;
    total_price: number;
    delivery_fee: number;
    created_at: string;
    items: any[];
    notes?: string;
}

interface Driver {
    id: number;
    name: string;
    username: string;
    phone?: string;
    isAvailable: boolean;
}

// Stats Card Component
function StatsCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md flex-1 min-w-[140px]"
        >
            <div className="flex justify-between items-start mb-3">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color + '20' }}
                >
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        </motion.div>
    );
}

// Order Card Component
function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
    const statusColors: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    const statusLabels: Record<string, string> = {
        pending: 'قيد الانتظار',
        in_progress: 'قيد التوصيل',
        delivered: 'مكتمل',
        cancelled: 'ملغي',
    };

    // Calculate total price if not provided directly
    // Fallback to ensuring it's at least just delivery fee if products are 0
    let displayPrice = Number(order.total_price || 0);
    if (displayPrice === 0) {
        // Try to sum subtotal + delivery
        // Assuming 'price' might be the subtotal field if total_price is missing
        const subtotal = Number((order as any).price || 0);
        const delivery = Number(order.delivery_fee || 0);
        displayPrice = subtotal + delivery;
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all border border-slate-100 dark:border-slate-700"
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">#{order.id}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{order.customer_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || statusColors.pending}`}>
                    {statusLabels[order.status] || order.status}
                </span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                    {new Date(order.created_at).toLocaleDateString('ar-EG')}
                </span>
                <div className="flex flex-col items-end">
                    <span className="font-bold text-emerald-500 text-base dir-rtl">
                        {(() => {
                            const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                            const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                            const deliFee = parseFloat(order.delivery_fee?.toString() || '0');
                            const grandTotal = itemsTotal + deliFee;
                            return grandTotal.toFixed(0);
                        })()} ج.م
                    </span>
                    <span className="text-xs text-slate-400 font-medium dir-rtl">
                        + {Number(order.delivery_fee || 0).toFixed(0)} توصيل
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

// Order Details Modal
function OrderDetailsModal({ order, onClose }: { order: Order; onClose: () => void }) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);

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
                    className="bg-white dark:bg-slate-900 rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-lg font-bold">تفاصيل الطلب #{order.id}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Customer Info */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-3">بيانات العميل</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="text-slate-800 dark:text-slate-200">{order.customer_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <a href={`tel:${order.customer_phone}`} className="text-blue-600 dark:text-blue-400">
                                        {order.customer_phone}
                                    </a>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                                    <span className="text-slate-800 dark:text-slate-200">{order.delivery_address}</span>
                                </div>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-3">
                                <ShoppingBag className="w-4 h-4 inline ml-1" />
                                المنتجات ({items.length})
                            </h3>
                            <div className="space-y-3">
                                {items.length > 0 ? items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{item.name || item.product_name || 'منتج'}</p>
                                            <p className="text-sm text-slate-500">الكمية: {item.quantity || 1}</p>
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">
                                            {(item.price || item.unit_price || 0)} ج.م
                                        </p>
                                    </div>
                                )) : (
                                    <p className="text-slate-500 text-center py-4">لا توجد منتجات مسجلة</p>
                                )}
                            </div>
                        </div>

                        {/* Order Summary */}
                        {(() => {
                            // Calculate products total from items array
                            const productsTotal = items.reduce((sum: number, item: any) => {
                                const price = Number(item.price || item.unit_price || 0);
                                const quantity = Number(item.quantity || 1);
                                return sum + (price * quantity);
                            }, 0);
                            const deliveryFee = Number(order.delivery_fee || 0);
                            const grandTotal = productsTotal + deliveryFee;

                            return (
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                                    <div className="flex justify-between items-center mb-2">
                                        <span>إجمالي المنتجات</span>
                                        <span>{productsTotal.toFixed(0)} ج.م</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span>رسوم التوصيل</span>
                                        <span>{deliveryFee.toFixed(0)} ج.م</span>
                                    </div>
                                    <div className="border-t border-white/30 pt-2 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-lg">الإجمالي</span>
                                            <span className="font-bold text-lg">{grandTotal.toFixed(0)} ج.م</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Notes */}
                        {order.notes && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                                <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400 mb-2">ملاحظات</h3>
                                <p className="text-slate-700 dark:text-slate-300">{order.notes}</p>
                            </div>
                        )}

                        {/* Date */}
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>تاريخ الطلب: {new Date(order.created_at).toLocaleString('ar-EG')}</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default function DriverDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const driverId = params.id as string;

    const [driver, setDriver] = useState<Driver | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        if (driverId) {
            fetchDriverData();
        }
    }, [driverId]);

    const fetchDriverData = async () => {
        try {
            // Fetch driver info
            const usersData = await apiCall('/halan/users?role=courier');
            if (usersData.success) {
                const foundDriver = usersData.data.find((u: any) => String(u.id) === String(driverId));
                if (foundDriver) {
                    setDriver(foundDriver);
                }
            }

            // Fetch driver's orders
            const ordersData = await apiCall(`/halan/orders?courierId=${driverId}`);
            if (ordersData.success) {
                setOrders(ordersData.data);
            }
        } catch (error) {
            console.error('Error fetching driver data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate stats
    const stats = {
        totalOrders: orders.length,
        deliveredOrders: orders.filter(o => o.status === 'delivered').length,
        totalSales: orders.filter(o => o.status === 'delivered').reduce((sum, o) => {
            const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
            const itemsTotal = items.reduce((iSum: number, item: any) => iSum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
            const deliFee = parseFloat(o.delivery_fee?.toString() || '0');
            return sum + (itemsTotal + deliFee);
        }, 0),
        totalDeliveryFees: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0),
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' }}
            >
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                        <ArrowRight className="w-5 h-5 text-white" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white">{driver?.name || 'المندوب'}</h1>
                        <p className="text-white/80 text-sm">@{driver?.username}</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 -mb-12">
                    <StatsCard
                        title="إجمالي الطلبات"
                        value={stats.totalOrders}
                        icon={Package}
                        color="#6366F1"
                    />
                    <StatsCard
                        title="الطلبات المكتملة"
                        value={stats.deliveredOrders}
                        icon={CheckCircle}
                        color="#22C55E"
                    />
                    <StatsCard
                        title="إجمالي المبيعات"
                        value={`${stats.totalSales.toFixed(0)}`}
                        icon={DollarSign}
                        color="#F59E0B"
                    />
                    <StatsCard
                        title="أرباح التوصيل"
                        value={`${stats.totalDeliveryFees.toFixed(0)}`}
                        icon={DollarSign}
                        color="#10B981"
                    />
                </div>
            </div>

            {/* Orders List */}
            <div className="p-4 pt-16">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-violet-600" />
                    الطلبات ({orders.length})
                </h2>

                {orders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p>لا توجد طلبات لهذا المندوب</p>
                    </div>
                ) : (
                    <div className="space-y-3 pb-8">
                        {orders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                onClick={() => setSelectedOrder(order)}
                            />
                        ))}
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
