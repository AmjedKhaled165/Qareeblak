"use client";

import { useEffect, useState, useCallback } from "react";
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
    Calendar,
    FileSpreadsheet,
    Loader2
} from "lucide-react";
import { apiCall } from "@/lib/api";

interface Order {
    id: number;
    display_id?: number | string;
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

interface Manager {
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
                    <p className="font-bold text-slate-800 dark:text-slate-100">#{order.display_id || order.id}</p>
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
                            const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
                            const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item?.price || item?.unit_price) || 0) * (parseFloat(item?.quantity) || 1)), 0);
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
    const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);

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
                        <h2 className="text-lg font-bold">تفاصيل الطلب #{order.display_id || order.id}</h2>
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

export default function ManagerDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const managerId = params.id as string;

    const [manager, setManager] = useState<Manager | null>(null);
    const [rawOrders, setRawOrders] = useState<Order[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Period state
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [customDateInput, setCustomDateInput] = useState<string>('');
    const [activeCustomDate, setActiveCustomDate] = useState<string>('');

    const periods = [
        { key: 'today', label: 'اليوم' },
        { key: 'week', label: 'الأسبوع' },
        { key: 'month', label: 'الشهر' },
    ];

    useEffect(() => {
        if (managerId) {
            fetchManagerData();
        }
    }, [managerId]);

    const fetchManagerData = async () => {
        try {
            // Fetch manager info
            const usersData = await apiCall('/halan/users?role=supervisor');
            if (usersData.success) {
                const foundManager = usersData.data.find((u: any) => String(u.id) === String(managerId));
                if (foundManager) {
                    setManager(foundManager);
                }
            }

            // Fetch manager's orders
            const ordersData = await apiCall(`/halan/orders?supervisorId=${managerId}`);
            if (ordersData.success) {
                setRawOrders(ordersData.data);
            }
        } catch (error) {
            console.error('Error fetching manager data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter orders based on period
    useEffect(() => {
        const isDateInPeriod = (dateString: string, p: string) => {
            if (!dateString) return false;
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return false;
            const start = new Date();
            start.setHours(0, 0, 0, 0);

            if (p === 'today') {
                return date >= start;
            }
            if (p === 'week') {
                const day = start.getDay();
                const diff = (day + 1) % 7;
                start.setDate(start.getDate() - diff);
                return date >= start;
            }
            if (p === 'month') {
                start.setDate(1);
                return date >= start;
            }
            if (p === 'custom' && activeCustomDate) {
                const customStart = new Date(activeCustomDate);
                customStart.setHours(0, 0, 0, 0);
                const customEnd = new Date(activeCustomDate);
                customEnd.setHours(23, 59, 59, 999);
                return date >= customStart && date <= customEnd;
            }
            return true;
        };

        const filtered = rawOrders.filter((o) => isDateInPeriod(o.created_at, period));
        setOrders(filtered);
    }, [rawOrders, period, activeCustomDate]);

    // Calculate stats
    const stats = {
        totalOrders: orders.length,
        deliveredOrders: orders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status)).length,
        totalSales: orders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status)).reduce((sum, o) => {
            const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
            const itemsTotal = items.reduce((iSum: number, item: any) => iSum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
            const deliFee = parseFloat(o.delivery_fee?.toString() || '0');
            return sum + (itemsTotal + deliFee);
        }, 0),
        totalDeliveryFees: orders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status)).reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0),
    };

    // ──── Individual Excel Export ────
    const [isExporting, setIsExporting] = useState(false);

    const getPeriodLabel = useCallback(() => {
        switch (period) {
            case 'today': return 'اليوم';
            case 'week': return 'هذا الأسبوع';
            case 'month': return 'هذا الشهر';
            case 'custom': return activeCustomDate || 'يوم محدد';
            default: return '';
        }
    }, [period, activeCustomDate]);

    const handleExportExcel = useCallback(async () => {
        if (!manager) return;
        setIsExporting(true);
        try {
            const XLSX = await import('xlsx');

            const normalizeSourceKey = (source?: string) => {
                const value = String(source || '').toLowerCase();
                if (value.includes('qareeblak')) return 'qareeblak';
                if (value.includes('whatsapp') || value.includes('واتس') || value.includes('وتس')) return 'whatsapp';
                if (value.includes('manual') || value.includes('يدوي')) return 'manual';
                return value || 'غير محدد';
            };
            const mapSourceLabel = (source?: string) => {
                switch (normalizeSourceKey(source)) {
                    case 'qareeblak': return 'قريبلك';
                    case 'manual': return 'يدوي';
                    case 'whatsapp': return 'واتساب';
                    default: return source || 'غير محدد';
                }
            };

            const delivered = orders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
            const qareeblakOrders = orders.filter((o: any) => normalizeSourceKey(o.source) === 'qareeblak');
            const manualOrders = orders.filter((o: any) => normalizeSourceKey(o.source) === 'manual');
            const whatsappOrders = orders.filter((o: any) => normalizeSourceKey(o.source) === 'whatsapp');

            const getItemsTotal = (o: any) => {
                let items: any[] = [];
                try { items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []); } catch { items = []; }
                return items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
            };

            const wsData: any[][] = [];

            // Title
            wsData.push([`تقرير المسؤول: ${manager.name}`]);
            wsData.push([`الفترة: ${getPeriodLabel()}`]);
            wsData.push([`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`]);
            wsData.push([]);

            // Summary
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push(['ملخص الأداء']);
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push([]);
            wsData.push(['البند', 'القيمة']);
            wsData.push(['إجمالي الطلبات', orders.length]);
            wsData.push(['طلبات مكتملة', delivered.length]);
            wsData.push(['طلبات معلقة', orders.filter((o: any) => o.status === 'pending').length]);
            wsData.push(['طلبات ملغاة', orders.filter((o: any) => ['cancelled', 'deleted'].includes(o.status)).length]);
            wsData.push(['رسوم التوصيل (ج.م)', stats.totalDeliveryFees]);
            wsData.push(['مبيعات المنتجات (ج.م)', delivered.reduce((s: number, o: any) => s + getItemsTotal(o), 0)]);
            wsData.push(['الإجمالي الكلي (ج.م)', stats.totalSales]);
            wsData.push([]);

            // By source
            wsData.push(['تفصيل حسب المصدر', 'عدد الطلبات', 'مكتملة', 'رسوم توصيل', 'مبيعات']);
            const qareeblakDel = qareeblakOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
            const manualDel = manualOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
            const whatsappDel = whatsappOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
            wsData.push(['قريبلك', qareeblakOrders.length, qareeblakDel.length, qareeblakDel.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0), qareeblakDel.reduce((s: number, o: any) => s + getItemsTotal(o), 0)]);
            wsData.push(['يدوي', manualOrders.length, manualDel.length, manualDel.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0), manualDel.reduce((s: number, o: any) => s + getItemsTotal(o), 0)]);
            wsData.push(['واتساب', whatsappOrders.length, whatsappDel.length, whatsappDel.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0), whatsappDel.reduce((s: number, o: any) => s + getItemsTotal(o), 0)]);
            wsData.push([]);
            wsData.push([]);

            // Detailed orders
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push(['تفاصيل الطلبات']);
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push([]);

            const statusLabels: Record<string, string> = {
                pending: 'قيد الانتظار', assigned: 'تم التعيين', in_progress: 'قيد التوصيل',
                out_for_delivery: 'في الطريق', delivered: 'مكتمل', cancelled: 'ملغي', deleted: 'ملغي', picked_up: 'تم الاستلام'
            };

            wsData.push(['رقم الطلب', 'اسم العميل', 'رقم العميل', 'عنوان التوصيل', 'الحالة', 'المصدر', 'المنتجات', 'سعر المنتجات (ج.م)', 'رسوم التوصيل (ج.م)', 'الإجمالي (ج.م)', 'تاريخ الإنشاء']);

            for (const order of orders) {
                let items: any[] = [];
                try { items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []); } catch { items = []; }
                const itemsNames = items.map((i: any) => `${i.name || i.product_name || 'منتج'} (${i.quantity || 1})`).join(' | ');
                const itemsTotal = getItemsTotal(order);
                const deliveryFee = parseFloat(String(order.delivery_fee || '0'));

                wsData.push([
                    order.display_id || order.id, order.customer_name || '-', order.customer_phone || '-',
                    order.delivery_address || '-', statusLabels[order.status] || order.status || '-',
                    mapSourceLabel((order as any).source), itemsNames || '-', itemsTotal, deliveryFee, itemsTotal + deliveryFee,
                    order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-'
                ]);
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
            const periodForFileName = period === 'custom' ? (activeCustomDate || 'custom') : period;
            XLSX.utils.book_append_sheet(wb, ws, 'تقرير المسؤول');
            XLSX.writeFile(wb, `تقرير_${manager.name}_${periodForFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    }, [manager, orders, stats, period, activeCustomDate, getPeriodLabel]);

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
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">{manager?.name || 'المسؤول'}</h1>
                        <p className="text-white/80 text-sm">@{manager?.username}</p>
                    </div>
                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        title={`تصدير شيت إكسل (${getPeriodLabel()})`}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-emerald-500/80 transition-all disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <FileSpreadsheet className="w-5 h-5 text-white" />}
                    </button>
                </div>

                {/* Period Toggles */}
                <div className="flex flex-col items-center gap-3 mb-6 relative z-10">
                    <div className="flex gap-1.5 p-1 bg-black/20 backdrop-blur-md rounded-2xl w-fit border border-white/10 overflow-x-auto">
                        {periods.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${period === p.key
                                    ? 'bg-white text-violet-600 shadow-md'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setPeriod('custom')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${period === 'custom'
                                ? 'bg-white text-violet-600 shadow-md'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            يوم محدد
                        </button>
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customDateInput}
                                onChange={(e) => setCustomDateInput(e.target.value)}
                                className="px-3 py-2 rounded-xl text-xs bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-white/50 outline-none"
                            />
                            <button
                                onClick={() => setActiveCustomDate(customDateInput)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-violet-600 hover:bg-white/90 transition-colors shadow-md"
                            >
                                تم
                            </button>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 -mb-12 relative z-10">
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
                        <p>لا توجد طلبات لهذا المسؤول</p>
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
