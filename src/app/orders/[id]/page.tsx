"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Phone,
    Clock,
    MapPin,
    XCircle,
    AlertCircle,
    Package,
    Store,
    CheckCircle2,
    Truck,
    ArrowRight,
    MessageCircle,
    Plus,
    ShoppingCart,
    Timer,
    Trash2,
    Check,
    Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { bookingsApi, apiCall } from '@/lib/api';
import { useToast } from "@/components/providers/ToastProvider";
import { isMaintenanceProvider } from '@/lib/category-utils';

interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

interface Order {
    id: string | number;
    status: string;
    halanStatus: string;
    providerName: string;
    serviceName?: string;
    date: string;
    items?: OrderItem[];
    price?: number;
    details?: string;
    courier?: {
        name: string;
        phone: string;
    };
    appointmentType?: string;
    appointment_type?: string;
    category?: string;
    source?: string;
    isQareeblak?: boolean;
    appointmentDate?: string;
    providerPhone?: string;
    address?: string;
}

export default function OrderTrackingPage() {
    const params = useParams();
    const router = useRouter();
    const { currentUser, bookings } = useAppStore();
    const { toast } = useToast();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [editingItem, setEditingItem] = useState<{ id: string; quantity: number } | null>(null);

    const orderId = useMemo(() => {
        const raw = params?.id;
        if (Array.isArray(raw)) return String(raw[0] || '');
        return String(raw || '');
    }, [params]);

    // ==================== VALIDATION LOGIC ====================
    /**
     * Determines if modifications are allowed based on time and status
     * Rule A: Time limit - only within 5 minutes
     * Rule B: Status - block if "Out for Delivery" (جاري التوصيل)
     */
    const canModifyOrder = (): { allowed: boolean; reason?: string } => {
        if (!order) return { allowed: false, reason: "جاري تحميل البيانات..." };

        // Rule B: Check status for "Out for Delivery" - IMMEDIATELY BLOCK
        const outForDeliveryStatuses = ['in_transit', 'picked_up'];
        if (outForDeliveryStatuses.includes(order.halanStatus)) {
            return {
                allowed: false,
                reason: "لا يمكن تعديل الطلب أثناء توصيله"
            };
        }

        // Rule A: Check time window (5 minutes)
        if (timeLeft === null || timeLeft <= 0) {
            return {
                allowed: false,
                reason: "انتهت فترة التعديل (5 دقائق)"
            };
        }

        return { allowed: true };
    };

    const modificationRules = canModifyOrder();
    const canAddItems = modificationRules.allowed && order?.halanStatus !== 'delivered' && order?.status !== 'delivered' && !['cancelled', 'rejected'].includes(order?.status || '');
    const canEditItem = modificationRules.allowed;
    const canDeleteItem = modificationRules.allowed;

    // ==================== END VALIDATION LOGIC ====================

    useEffect(() => {
        if (!currentUser) {
            router.push("/login");
            return;
        }
        fetchOrderDetails();
        const interval = setInterval(fetchOrderDetails, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchOrderDetails = async () => {
        try {
            console.log('🔵 Fetching order with ID:', orderId);
            let data;

            try {
                // Try the direct endpoint first
                data = await bookingsApi.getById(orderId);
            } catch (firstError: any) {
                console.warn('⚠️ Direct endpoint failed, trying alternatives...');

                // Fallback 1: Try to find in global app state (orders just created in this session)
                if (Array.isArray(bookings)) {
                    data = bookings.find((o: { id: string | number }) => String(o.id) === String(orderId));
                    if (data) console.log('✅ Found order in global bookings state');
                }

                // Fallback 2: try to get orders for current user (if logged in)
                if (!data && currentUser?.id) {
                    try {
                        const userOrders = await bookingsApi.getByUser(String(currentUser.id));
                        if (Array.isArray(userOrders)) {
                            data = userOrders.find((order: { id: string | number; booking_id?: string | number }) => String(order.id) === String(orderId) || String(order.booking_id) === String(orderId));
                        }
                    } catch (userError: any) {
                        console.warn('⚠️ User endpoint failed');
                    }
                }

                // Fallback 3: check localStorage (works for guests and logged in users)
                if (!data) {
                    console.log('🔍 Checking localStorage for order:', orderId);
                    const cachedOrders = localStorage.getItem('cached_orders');
                    if (cachedOrders) {
                        try {
                            const parsed = JSON.parse(cachedOrders);
                            // Deduplicate cached orders before finding
                            const uniqueParsed = parsed.reduce((acc: { id: string | number }[], curr: { id: string | number }) => {
                                if (!acc.some((n: { id: string | number }) => n.id === curr.id)) acc.push(curr);
                                return acc;
                            }, []);
                            data = uniqueParsed.find((order: { id: string | number }) => String(order.id) === String(orderId));
                            if (data) console.log('✅ Found order in localStorage cache');
                        } catch (cacheError) {
                            console.error('Error parsing cached orders');
                        }
                    }
                }

                // If still no data, throw the original error
                if (!data) {
                    throw firstError;
                }
            }

            if (!data) {
                throw new Error(`الطلب #${orderId} غير موجود`);
            }

            console.log('========== ✅ ORDER DATA ==========');
            console.log('Complete Order Object:', data);
            console.log('Order Keys:', Object.keys(data));
            console.log('Source:', data.source);
            console.log('Status:', data.status);
            console.log('Halan Status:', data.halanStatus);
            console.log('🔍 MAINTENANCE CHECK FIELDS:');
            console.log('  - appointmentType:', data.appointmentType);
            console.log('  - serviceName:', data.serviceName);
            console.log('  - providerName:', data.providerName);
            console.log('  - category:', data.category);
            console.log('  - appointment_type:', data.appointment_type);
            console.log('=====================================');

            setOrder(data);
            setError(null);

            // Calculate 5-minute window
            const bookingDate = new Date(data.date);
            const now = new Date();
            const diffSeconds = 300 - Math.floor((now.getTime() - bookingDate.getTime()) / 1000);
            setTimeLeft(diffSeconds > 0 ? diffSeconds : 0);
        } catch (error) {
            console.error("❌ Failed to fetch order - Full Error:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "حدث خطأ في جلب بيانات الحجز";
            setError(errorMessage);
            setOrder(null);
            if (error instanceof Error) {
                console.error("📛 Error Message:", error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (confirm("هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟")) {
            try {
                await bookingsApi.update(orderId, { status: 'cancelled' });
                toast("تم إلغاء الطلب بنجاح", "success");
                fetchOrderDetails();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "فشل الإلغاء";
                toast(errorMsg, "error");
            }
        }
    };

    const handleAddItems = () => {
        // Redirect to services page with context of current order
        router.push(`/explore?addToOrderId=${orderId}`);
    };

    const handleEditItem = (item: { id: string; quantity: number }) => {
        setEditingItem({
            id: item.id,
            quantity: item.quantity
        });
    };

    const handleSaveEditItem = async (newQuantity: number) => {
        if (!editingItem || !order) return;

        try {
            const currentItems = Array.isArray(order?.items) ? [...order.items] : [];
            const itemIndex = currentItems.findIndex(i => i.id === editingItem.id);

            if (itemIndex >= 0) {
                if (newQuantity <= 0) {
                    currentItems.splice(itemIndex, 1);
                    toast("تم حذف المنتج", "success");
                } else {
                    currentItems[itemIndex].quantity = newQuantity;
                    toast("تم تحديث المنتج", "success");
                }

                await bookingsApi.update(orderId, { items: currentItems });
                setEditingItem(null);
                fetchOrderDetails();
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "فشل التحديث";
            toast(msg, "error");
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        try {
            const currentItems = Array.isArray(order?.items) ? [...order.items] : [];
            const updated = currentItems.filter(i => i.id !== itemId);
            await bookingsApi.update(orderId, { items: updated });
            toast("تم حذف المنتج", "success");
            fetchOrderDetails();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "فشل الحذف";
            toast(msg, "error");
        }
    };

    const handleAcceptAppointment = async () => {
        try {
            await apiCall(`/bookings/${orderId}/accept-appointment`, {
                method: 'PATCH',
                body: JSON.stringify({ acceptedBy: 'customer' })
            });
            toast("تم تأكيد الموعد بنجاح! 📅", "success");
            fetchOrderDetails();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : "فشل تأكيد الموعد";
            toast(errorMsg, "error");
        }
    };

    const handleReschedule = async (newDate: Date) => {
        try {
            await apiCall(`/bookings/${orderId}/reschedule`, {
                method: 'PATCH',
                body: JSON.stringify({ newDate, updatedBy: 'customer' })
            });
            toast("تم إرسال اقتراح الموعد الجديد للمقدم", "success");
            fetchOrderDetails();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : "فشل تغيير الموعد";
            toast(errorMsg, "error");
        }
    };

    const stages = useMemo(() => {
        if (!order) return [];

        const steps = [
            {
                id: 'received',
                label: 'تم استلام الطلب',
                description: 'وصل طلبك للمطعم',
                icon: Clock,
                isCompleted: true,
                isActive: order.status === 'pending' || order.halanStatus === 'pending'
            },
            {
                id: 'preparing',
                label: 'جاري التحضير',
                description: 'بدأ المطعم في تحضير وجبتك',
                icon: Store,
                isCompleted: ['assigned', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered'].includes(order.halanStatus) || ['confirmed', 'completed'].includes(order.status),
                isActive: order.halanStatus === 'assigned' || order.status === 'confirmed'
            },
            {
                id: 'ready',
                label: 'جاري التوصيل',
                description: 'وجبتك جاهزة للاستلام',
                icon: Package,
                isCompleted: ['ready_for_pickup', 'picked_up', 'in_transit', 'delivered'].includes(order.halanStatus),
                isActive: order.halanStatus === 'ready_for_pickup'
            },
            {
                id: 'delivery_started',
                label: 'جاري التوصيل',
                description: 'المندوب في طريقه إليك',
                icon: Truck,
                isCompleted: ['picked_up', 'in_transit', 'delivered'].includes(order.halanStatus),
                isActive: ['picked_up', 'in_transit'].includes(order.halanStatus)
            },
            {
                id: 'delivered',
                label: 'تم التوصيل',
                description: 'بالهناء والشفاء! نتمنى لك يوماً سعيداً',
                icon: CheckCircle2,
                isCompleted: ['delivered', 'تم التوصيل'].includes(order.halanStatus || ''),
                isActive: ['delivered', 'تم التوصيل'].includes(order.halanStatus || '')
            }
        ];

        return steps;
    }, [order]);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-slate-500">جاري إحضار تفاصيل طلبك...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-6 text-center">
            <AlertCircle className="w-20 h-20 text-red-500" />
            <div>
                <h1 className="text-2xl font-bold mb-2">حدث خطأ في تحميل الطلب</h1>
                <p className="text-red-600 font-mono text-sm">{error}</p>
                <p className="text-slate-500 text-xs mt-4">ID: {orderId}</p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => window.location.reload()}>إعادة محاولة</Button>
                <Button variant="outline" onClick={() => router.push("/orders")}>العودة للطلبات</Button>
            </div>
        </div>
    );

    if (!order) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-6 text-center">
            <XCircle className="w-20 h-20 text-red-100 fill-white" />
            <h1 className="text-2xl font-bold">عذراً، لم نتمكن من العثور على هذا الطلب</h1>
            <Button onClick={() => router.push("/orders")}>العودة للطلبات</Button>
        </div>
    );

    // ==================== MAINTENANCE ORDER CHECK ====================
    // Maintenance and plumbing services don't need order tracking
    // They only require appointment scheduling and confirmation

    // Check both camelCase and snake_case versions of appointmentType
    const appointmentType = order.appointmentType || order.appointment_type;

    // Additional keywords to check in serviceName or providerName
    const maintenanceKeywords = ['صيانة', 'سباكة', 'كهرباء', 'نجارة', 'دهانات', 'تكييف'];
    const hasMaintenanceKeyword = (text: string | undefined) => {
        if (!text) return false;
        const normalized = text.toLowerCase();
        return maintenanceKeywords.some(keyword => normalized.includes(keyword));
    };

    console.log('🔍 Checking if maintenance order:', {
        appointmentType: appointmentType,
        serviceName: order.serviceName,
        providerName: order.providerName,
        providerCategory: order.category,
        status: order.status,
    });

    // COMPREHENSIVE CHECK: Use multiple detection methods
    // Priority: appointmentType field > status > category > keywords in name
    const isMaintenanceOrder =
        appointmentType === 'maintenance' ||
        order.status === 'pending_appointment' ||
        isMaintenanceProvider(order.category) ||
        isMaintenanceProvider(order.serviceName) ||
        isMaintenanceProvider(order.providerName) ||
        hasMaintenanceKeyword(order.serviceName) ||
        hasMaintenanceKeyword(order.providerName) ||
        hasMaintenanceKeyword(order.category);

    console.log('✅ Is maintenance order?', isMaintenanceOrder);
    console.log('   - By appointmentType?', appointmentType === 'maintenance');
    console.log('   - By status?', order.status === 'pending_appointment');
    console.log('   - By category utility?', isMaintenanceProvider(order.category));
    console.log('   - By serviceName utility?', isMaintenanceProvider(order.serviceName));
    console.log('   - By providerName utility?', isMaintenanceProvider(order.providerName));
    console.log('   - By serviceName keywords?', hasMaintenanceKeyword(order.serviceName));
    console.log('   - By providerName keywords?', hasMaintenanceKeyword(order.providerName));
    console.log('   - By category keywords?', hasMaintenanceKeyword(order.category));

    if (isMaintenanceOrder) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900" dir="rtl">
                {/* Header */}
                <div className="bg-indigo-600 text-white p-6 pb-16 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />

                    <div className="relative z-10 flex items-center justify-between">
                        <button
                            onClick={() => router.push("/orders")}
                            title="العودة للطلبات"
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowRight className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-black font-cairo">طلب صيانة</h1>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-xl mx-auto px-4 -mt-8 space-y-6 pb-20">
                    <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
                        <CardContent className="p-10 text-center space-y-6">
                            {/* Status-Based Icon & Message */}
                            {order.status === 'confirmed' ? (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/40 rounded-3xl flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="space-y-3">
                                        <h2 className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-cairo">
                                            تم تأكيد الموعد
                                        </h2>
                                        <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base leading-relaxed max-w-md mx-auto">
                                            تم قبول الطلب. يمكنك الآن التواصل مع الفني مباشرة.
                                        </p>
                                    </div>
                                </div>
                            ) : order.status === 'completed' ? (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/40 rounded-3xl flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="space-y-3">
                                        <h2 className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-cairo">
                                            تم إتمام الخدمة
                                        </h2>
                                        <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base leading-relaxed max-w-md mx-auto">
                                            شكراً لاستخدامك خدماتنا
                                        </p>
                                    </div>
                                </div>
                            ) : (order.status === 'cancelled' || order.status === 'rejected') ? (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 bg-red-100 dark:bg-red-900/40 rounded-3xl flex items-center justify-center mx-auto">
                                        <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="space-y-3">
                                        <h2 className="text-2xl font-black text-red-800 dark:text-red-300 font-cairo">
                                            {order.status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم رفض الطلب'}
                                        </h2>
                                        <p className="text-red-600 dark:text-red-400 font-bold text-base leading-relaxed max-w-md mx-auto">
                                            {order.status === 'cancelled' ? 'قمت بإلغاء هذا الطلب' : 'مقدم الخدمة غير متاح حالياً'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/40 rounded-3xl flex items-center justify-center mx-auto">
                                        <Clock className="w-12 h-12 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div className="space-y-3">
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white font-cairo">
                                            في انتظار الموعد
                                        </h2>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold text-base leading-relaxed max-w-md mx-auto">
                                            طلب صيانة يتطلب تحديد موعد للزيارة. سيتم التواصل معك قريباً.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Order Details */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-4 text-right">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold">رقم الطلب:</span>
                                    <span className="font-mono font-black text-lg text-indigo-600 dark:text-indigo-400">
                                        #{orderId.substring(0, 8).toUpperCase()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold">الخدمة:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{order.serviceName}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold">مقدم الخدمة:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{order.providerName}</span>
                                </div>

                                {order.appointmentDate && (
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            الموعد المحدد:
                                        </span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                                            {new Date(order.appointmentDate).toLocaleDateString('ar-EG', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold">الحالة:</span>
                                    <span className={`px-4 py-2 rounded-xl text-xs font-black ${order.status === 'pending' || order.status === 'pending_appointment'
                                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                                        : order.status === 'confirmed'
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                            : order.status === 'provider_rescheduled'
                                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                                                : order.status === 'customer_rescheduled'
                                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                    : order.status === 'completed'
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                        }`}>
                                        {order.status === 'pending' && 'بانتظار التأكيد'}
                                        {order.status === 'pending_appointment' && 'بانتظار مراجعة مقدم الخدمة'}
                                        {order.status === 'confirmed' && 'تم التأكيد'}
                                        {order.status === 'completed' && 'مكتمل'}
                                        {order.status === 'cancelled' && 'ملغي'}
                                        {order.status === 'rejected' && 'مرفوض'}
                                    </span>
                                </div>
                            </div>


                            {order.status === 'confirmed' && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center">
                                            <Phone className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-black text-emerald-900 dark:text-emerald-300 text-lg">✅ تم تأكيد الموعد!</p>
                                            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold">يمكنك الآن التواصل مع مقدم الخدمة</p>
                                        </div>
                                    </div>
                                    {order.providerPhone ? (
                                        <a
                                            href={`tel:${order.providerPhone}`}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                                        >
                                            <Phone className="w-5 h-5" />
                                            <span dir="ltr">{order.providerPhone}</span>
                                        </a>
                                    ) : (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                                            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">رقم الهاتف غير متوفر حالياً</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Privacy Notice and Status Messages */}
                            {order.status !== 'confirmed' && order.status !== 'completed' && (
                                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                        يظهر رقم هاتف الفني وتفاصيل التواصل فور قبول مقدم الخدمة 🔒
                                    </p>
                                </div>
                            )}


                            {/* Actions */}
                            <div className="space-y-3 pt-4">
                                <Button
                                    onClick={() => router.push("/orders")}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl font-black text-lg"
                                >
                                    عرض جميع الطلبات
                                </Button>
                                <Button
                                    onClick={() => router.push("/")}
                                    variant="outline"
                                    className="w-full border-2 border-slate-200 dark:border-slate-700 h-14 rounded-2xl font-bold"
                                >
                                    العودة للصفحة الرئيسية
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info Note */}
                    <Card className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-none">
                        <CardContent className="p-5">
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center shrink-0">
                                    <MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1 space-y-1 text-right">
                                    <h4 className="font-black text-indigo-900 dark:text-indigo-300 text-sm">ملاحظة هامة</h4>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-bold">
                                        سيقوم مقدم الخدمة بمراجعة طلبك إما بقبوله أو رفضه. فور القبول، ستحصل على رقم الهاتف للتنسيق.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    // ==================== END MAINTENANCE CHECK ====================

    const isCancelled = order.status === 'cancelled' || order.status === 'rejected';

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950" dir="rtl">
            {/* Header Overlay */}
            <div className="bg-indigo-600 text-white p-6 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />

                <div className="relative z-10 flex items-center justify-between mb-8">
                    <button onClick={() => router.push("/orders")} title="العودة للطلبات" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowRight className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">طلب رقم</p>
                        <h1 className="font-mono font-bold text-xl">#{orderId.substring(0, 8).toUpperCase()}</h1>
                    </div>
                    <div className="w-10" />
                </div>

                <div className="relative z-10 text-center space-y-2">
                    <div className="flex items-center justify-center gap-3">
                        <h2 className="text-3xl font-black font-cairo">{order.providerName}</h2>
                        {(order.source === 'qareeblak' || order.isQareeblak) && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/80 text-white text-xs font-black rounded-full">
                                🌐 قريبلك
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-indigo-100">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm font-medium">{order.details?.match(/العنوان:\s*([^|]+)/)?.[1]?.trim() || 'العنوان المسجل'}</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-xl mx-auto px-4 -mt-16 space-y-6 pb-32 relative z-20">

                {/* 1. Creative Tracking Timeline */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                    <CardContent className="p-8">
                        {isCancelled ? (
                            <div className="py-10 text-center space-y-4">
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                                    <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="text-2xl font-black text-red-600 dark:text-red-400 font-cairo">تم إلغاء الطلب</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">نعتذر عن عدم إتمام هذا الطلب. يمكنك الطلب مرة أخرى من أي مطعم آخر.</p>
                            </div>
                        ) : (
                            <div className="space-y-10 relative">
                                {/* Vertical Line Connection */}
                                <div className="absolute top-2 bottom-8 right-[27px] w-1 bg-slate-200 dark:bg-slate-700/50 rounded-full" />

                                {stages.map((stage, idx) => {
                                    const Icon = stage.icon;
                                    const lastCompletedIdx = stages.findLastIndex(s => s.isCompleted);
                                    const isCurrent = (idx === lastCompletedIdx);

                                    return (
                                        <div key={stage.id} className="relative flex items-start gap-6 group">
                                            <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-lg ${stage.isCompleted
                                                ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none'
                                                : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600'
                                                } ${isCurrent ? 'animate-pulse scale-110 ring-4 ring-indigo-100 dark:ring-indigo-900/40' : ''}`}>
                                                <Icon className="w-6 h-6" />

                                                {/* Connecting partial line */}
                                                {stage.isCompleted && idx < stages.length - 1 && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-10 bg-indigo-600" />
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-1 pt-1 text-right">
                                                <h4 className={`text-lg font-black font-cairo leading-none transition-colors ${stage.isCompleted ? 'text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-500'}`}>
                                                    {stage.label}
                                                </h4>
                                                <p className={`text-xs font-bold leading-relaxed transition-colors ${stage.isCompleted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                    {stage.description}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Cancellation/Modify Window */}
                {!isCancelled && order.status === 'pending' && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <Card className="rounded-[2.5rem] border-dashed border-2 border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20 shadow-none">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-2xl flex items-center justify-center">
                                        <Timer className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div className="flex-1 space-y-1 text-right">
                                        <h4 className="font-bold text-orange-800 dark:text-orange-300">نافذة التعديل</h4>
                                        <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">
                                            {timeLeft && timeLeft > 0
                                                ? `متبقي ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')} دقائق لإلغاء أو تعديل الطلب`
                                                : 'انتهت فترة الـ 5 دقائق المسموح فيها بالإلغاء'}
                                        </p>
                                    </div>
                                    {timeLeft !== null && timeLeft > 0 && (
                                        <Button variant="destructive" size="sm" className="rounded-xl font-bold" onClick={handleCancel}>إلغاء</Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* 3. Courier Info Card */}
                {order.courier && order.halanStatus !== 'delivered' && !isCancelled && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-slate-900 text-white overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-5">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-black ring-4 ring-white/10">
                                            {order.courier.name[0]}
                                        </div>
                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-emerald-500 border-4 border-slate-900 rounded-full" />
                                    </div>
                                    <div className="flex-1 space-y-1 text-right">
                                        <p className="text-xs text-indigo-400 font-black uppercase tracking-widest">المندوب المتصل</p>
                                        <h4 className="text-xl font-black font-cairo">{order.courier.name}</h4>
                                        <div className="flex gap-4 pt-2">
                                            <a href={`tel:${order.courier.phone}`} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                                <Phone className="w-3.5 h-3.5" />
                                                اتصال
                                            </a>
                                            <a href={`https://wa.me/${order.courier.phone}`} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                واتساب
                                            </a>
                                        </div>
                                    </div>
                                    {['picked_up', 'in_transit'].includes(order.halanStatus) && (
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl"
                                            onClick={async () => {
                                                if (confirm("هل استلمت الطلب بالفعل؟")) {
                                                    await bookingsApi.update(orderId, { status: 'delivered' });
                                                    fetchOrderDetails();
                                                }
                                            }}
                                        >
                                            استلمت
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* 4. Order Details & Adding Items */}
                <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-slate-800 overflow-hidden">
                    <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-black text-lg font-cairo">تفاصيل الطلب</h3>
                        </div>
                        {canAddItems ? (
                            <Button size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold gap-1" onClick={handleAddItems}>
                                <Plus className="w-4 h-4" />
                                إضافة أصناف
                            </Button>
                        ) : (
                            <div className="text-xs text-slate-400 font-bold">
                                {modificationRules.reason}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Order Items List */}
                        <div className="p-6 space-y-4">
                            {Array.isArray(order?.items) && order.items.length > 0 ? (
                                order.items.map((item: { name: string; quantity: number; price: number; id: string }, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {item.quantity}x
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-indigo-600 font-cairo text-sm">{item.price * item.quantity} ج.م</p>
                                            <div className="flex gap-1 ml-2">
                                                {canEditItem && (
                                                    <button
                                                        onClick={() => handleEditItem(item)}
                                                        title="تعديل المنتج"
                                                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-600 transition-colors"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                                {canDeleteItem && (
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        title="حذف المنتج"
                                                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">{order.details?.split('|')[0] || "لا توجد تفاصيل للمنتجات"}</p>
                            )}

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-6 flex justify-between items-center">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-xs">الإجمالي المستحق</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white font-cairo">{order.price || '؟؟'} ج.م</span>
                            </div>
                        </div>

                        {/* Order Notes Footer */}
                        {order.details && (
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/40 flex items-start gap-4">
                                <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1 text-right">
                                    <p className="text-xs font-black text-slate-400 uppercase">ملاحظات العنوان والتسليم</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">{order.details}</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Edit Item Modal */}
                <AnimatePresence>
                    {editingItem && order?.items && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-50 flex items-end"
                            onClick={() => setEditingItem(null)}
                        >
                            <motion.div
                                initial={{ y: 100 }}
                                animate={{ y: 0 }}
                                exit={{ y: 100 }}
                                className="w-full bg-white rounded-t-[2rem] p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(() => {
                                    const item = order.items.find((i: { id: string }) => i.id === editingItem.id);
                                    if (!item) return null;

                                    return (
                                        <div className="space-y-6" dir="rtl">
                                            <div className="text-center space-y-1">
                                                <h2 className="text-2xl font-black font-cairo">{item.name}</h2>
                                                <p className="text-slate-500 text-sm">{item.price} ج.م لكل وحدة</p>
                                            </div>

                                            {/* Quantity Adjuster */}
                                            <div className="space-y-3">
                                                <label className="text-sm font-black text-slate-600">الكمية</label>
                                                <div className="flex items-center justify-center gap-4 bg-slate-50 p-4 rounded-xl">
                                                    <button
                                                        onClick={() => handleSaveEditItem(editingItem.quantity - 1)}
                                                        className="w-12 h-12 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-lg font-bold"
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={editingItem.quantity}
                                                        onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 0 })}
                                                        className="w-20 text-center text-xl font-black border-0 bg-transparent"
                                                        title="الكمية"
                                                        aria-label="تغيير كمية المنتج"
                                                    />
                                                    <button
                                                        onClick={() => handleSaveEditItem(editingItem.quantity + 1)}
                                                        className="w-12 h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-lg font-bold"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Total */}
                                            <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
                                                <span className="font-black text-slate-600">الإجمالي:</span>
                                                <span className="text-2xl font-black text-indigo-600 font-cairo">{item.price * editingItem.quantity} ج.م</span>
                                            </div>

                                            {/* Actions */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl font-bold"
                                                    onClick={() => setEditingItem(null)}
                                                >
                                                    إلغاء
                                                </Button>
                                                <Button
                                                    className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white"
                                                    onClick={() => handleSaveEditItem(editingItem.quantity)}
                                                >
                                                    حفظ التغييرات
                                                </Button>
                                            </div>

                                            {/* Delete option */}
                                            <Button
                                                variant="destructive"
                                                className="w-full rounded-xl font-bold"
                                                onClick={() => handleSaveEditItem(0)}
                                            >
                                                حذف المنتج
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
