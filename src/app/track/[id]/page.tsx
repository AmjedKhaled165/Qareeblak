"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from 'canvas-confetti';
import { io } from "socket.io-client";
import { bookingsApi } from "@/lib/api";
import { isMaintenanceProvider } from "@/lib/category-utils";
import {
    Package,
    Store,
    ChefHat,
    Truck,
    CheckCircle,
    Clock,
    Phone,
    MessageCircle,
    MapPin,
    Plus,
    Minus,
    Edit3,
    X,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    Loader2,
    Trash2
} from "lucide-react";

interface OrderItem {
    name: string;
    price: number;
    quantity: number;
    notes?: string;
}

interface Order {
    id: number;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    pickup_address: string;
    status: string;
    items: OrderItem[];
    delivery_fee: number;
    notes: string;
    created_at: string;
    courier_name?: string;
    courier_phone?: string;
    provider_id?: string | number;
    provider_name?: string;
    // Parent Order extensions
    is_parent?: boolean;
    total_price?: number;
    sub_orders?: SubOrder[];
    // Maintenance fields
    appointment_type?: 'maintenance' | 'immediate';
    appointment_date?: string;
    service_name?: string;
    category?: string;
    display_id?: number | string;
}

interface SubOrder {
    display_id?: string | number;
    id: number;
    provider_name: string;
    status: string;
    halan_status?: string;
    price: number;
    items: OrderItem[];
    courier_name?: string;
    courier_phone?: string;
}

function normalizeTrackingStatus(status: string) {
    const raw = String(status || '').trim().toLowerCase();
    const aliases: Record<string, string> = {
        'تم استلام الطلب': 'pending',
        'new': 'pending',
        'pending': 'pending',

        'جاري التحضير': 'confirmed',
        'processing': 'confirmed',
        'confirmed': 'confirmed',
        'accepted': 'confirmed',
        'assigned': 'confirmed',

        'تم التجهيز': 'ready_for_pickup',

        'تم التحضير': 'ready_for_pickup',
        'جاهز للاستلام': 'ready_for_pickup',
        'ready': 'ready_for_pickup',
        'completed': 'ready_for_pickup',
        'ready_for_pickup': 'ready_for_pickup',

        'تم الاستلام من المطعم': 'in_transit',
        'جاري التوصيل': 'in_transit',
        'picked_up': 'in_transit',
        'in_transit': 'in_transit',

        'تم التوصيل': 'delivered',
        'delivered': 'delivered',

        'ملغي': 'cancelled',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
        'rejected': 'cancelled'
    };

    return aliases[raw] || raw || 'pending';
}

// API base URL
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api$/, '').replace(/\/$/, '');

export default function TrackOrderPage() {
    const params = useParams();
    const router = useRouter();
    const trackingId = params?.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [canModify, setCanModify] = useState(false);

    // Modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetch order data
    const fetchOrder = useCallback(async () => {
        if (!trackingId) return;

        try {
            const response = await fetch(`${API_BASE}/api/halan/orders/track/${trackingId}`);
            const data = await response.json();

            if (data.success && data.order) {
                setOrder(data.order);
                setError(null);

                // Calculate time remaining for modifications (5 minutes = 300 seconds)
                const createdAt = new Date(data.order.created_at).getTime();
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - createdAt) / 1000);
                const remaining = Math.max(0, 300 - elapsedSeconds);
                setTimeRemaining(remaining);
                
                const isPastAssigned = (status: string) => {
                    const norm = normalizeTrackingStatus(status);
                    return ['ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'completed'].includes(norm);
                };
                
                const hasAnyProviderPrepared = 
                    (data.order.sub_orders && data.order.sub_orders.some((sub: any) => isPastAssigned(sub.status))) || 
                    isPastAssigned(data.order.status);

                setCanModify(remaining > 0 && !hasAnyProviderPrepared);
            } else {
                setError(data.error || 'الطلب غير موجود');
            }
        } catch (err) {
            console.error('Error fetching order:', err);
            setError('حدث خطأ في تحميل بيانات الطلب');
        } finally {
            setIsLoading(false);
        }
    }, [trackingId]);

    useEffect(() => {
        fetchOrder();

        // 🟢 Real-time Socket Listener
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const socketUrl = apiUrl.replace(/\/api$/, '');
        const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');
        const socket = token
            ? io(socketUrl, {
                transports: ['polling', 'websocket'],
                auth: { token }
            })
            : null;

        socket?.on('connect', () => {
            console.log('Connected to tracking updates');
        });

        socket?.on('order-status-changed', (data) => {
            // Check if this update belongs to our order or any of our sub-orders
            // trackingId could be "1" or "P1"
            const cleanId = String(trackingId).replace('P', '');
            const incomingId = String(data.orderId).replace('P', '');

            if (cleanId === incomingId || String(data.orderId) === String(trackingId)) {
                console.log('Detected status change for tracked order, refreshing...');
                fetchOrder();
            }
        });

        socket?.on('booking-updated', (data) => {
            const cleanId = String(trackingId).replace('P', '');

            // Refresh if tracking this specific booking OR if tracking the parent of this booking
            if (
                String(data.id) === cleanId ||
                String(data.parentId) === cleanId ||
                String(data.id) === String(trackingId) ||
                Boolean(data.halanOrderId)
            ) {
                console.log('Detected booking update for tracked order, refreshing...');
                fetchOrder();
            }
        });

        // Auto-refresh every 30 seconds as fallback
        const interval = setInterval(fetchOrder, 30000);
        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('connect');
                socket.off('order-status-changed');
                socket.off('booking-updated');
                socket.disconnect();
            }
        };
    }, [fetchOrder, trackingId]);

    // Countdown timer for modification window
    useEffect(() => {
        if (timeRemaining > 0) {
            const timer = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        setCanModify(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [timeRemaining]);

    // Format time remaining
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Status configuration
    const statusConfig = {
        pending: {
            label: 'تم استلام الطلب',
            icon: Package,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500',
            step: 1
        },
        new: {
            label: 'تم استلام الطلب',
            icon: Package,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500',
            step: 1
        },
        confirmed: {
            label: 'جاري التحضير',
            icon: ChefHat,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500',
            step: 2
        },
        accepted: {
            label: 'جاري التحضير',
            icon: ChefHat,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500',
            step: 2
        },
        processing: {
            label: 'جاري التحضير',
            icon: ChefHat,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500',
            step: 2
        },
        assigned: {
            label: 'تم استلام الطلب',
            icon: Package,
            color: 'text-amber-500',
            bgColor: 'bg-amber-500',
            step: 1
        },
        ready_for_pickup: {
            label: 'تم التحضير',
            icon: ChefHat,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 3
        },
        ready: {
            label: 'تم التحضير',
            icon: ChefHat,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 3
        },
        completed: {
            label: 'تم التحضير',
            icon: ChefHat,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 3
        },
        'مكتمل': {
            label: 'تم التحضير',
            icon: ChefHat,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 3
        },
        'جاري التنفيذ': {
            label: 'جاري التحضير',
            icon: ChefHat,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500',
            step: 2
        },
        'تم التجهيز': {
            label: 'جاري التوصيل',
            icon: Store,
            color: 'text-indigo-500',
            bgColor: 'bg-indigo-500',
            step: 3
        },
        'تم التوصيل': {
            label: 'تم التوصيل',
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 5
        },
        picked_up: {
            label: 'جاري التوصيل',
            icon: Store,
            color: 'text-violet-500',
            bgColor: 'bg-violet-500',
            step: 4
        },
        in_transit: {
            label: 'جاري التوصيل',
            icon: Truck,
            color: 'text-violet-500',
            bgColor: 'bg-violet-500',
            step: 4
        },
        delivered: {
            label: 'تم التوصيل',
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-500',
            step: 5
        },
        cancelled: {
            label: 'تم الإلغاء',
            icon: X,
            color: 'text-red-500',
            bgColor: 'bg-red-500',
            step: 0
        }
    };

    const getStatusInfo = (status: string) => {
        const cleanStatus = normalizeTrackingStatus(status);
        return statusConfig[cleanStatus as keyof typeof statusConfig] || statusConfig.pending;
    };

    const currentStatus = order ? getStatusInfo(order.status) : statusConfig.pending;
    const StatusIcon = currentStatus.icon;

    // Celebration Effect (Moved below currentStatus evaluation)
    useEffect(() => {
        if (!order) return;
        
        // Exclusively rely on the visual UI mapping (step 5 happens when it reaches "تم التوصيل")
        if (currentStatus.step === 5) {
            const storageKey = `celebration_v5_${order.id}`; // Changed key so it definitely fires again
            const hasCelebrated = localStorage.getItem(storageKey);
            
            if (!hasCelebrated) {
                console.log('🎉 Triggering FINAL celebration for order!', order.id, 'Mapped Step:', currentStatus.step);
                // Trigger confetti
                const duration = 5 * 1000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 99999 };

                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                const interval: any = setInterval(function () {
                    const timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 60 * (timeLeft / duration);
                    // Fast bursts for a massive celebration mood
                    confetti({
                        ...defaults,
                        particleCount,
                        origin: { x: randomInRange(0.1, 0.4), y: Math.random() - 0.2 },
                        colors: ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#ffffff']
                    });
                    confetti({
                        ...defaults,
                        particleCount,
                        origin: { x: randomInRange(0.6, 0.9), y: Math.random() - 0.2 },
                        colors: ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#ffffff']
                    });
                }, 250);

                // Initial big bursts
                confetti({
                    particleCount: 200,
                    spread: 120,
                    origin: { y: 0.6 },
                    zIndex: 99999,
                    colors: ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#ffffff']
                });

                // Play success sound
                try {
                    const audio = new Audio('/success.mp3');
                    audio.play().catch(() => { });
                } catch (e) { }

                localStorage.setItem(storageKey, 'true');
            }
        }
    }, [currentStatus.step, order?.id]);


    // Can add items until 'In Transit' (picked_up or in_transit)
    const canAddItems = canModify;

    // Cancel order
    const handleCancelOrder = async () => {
        if (!order || !canModify) return;
        setIsSubmitting(true);

        try {
            const { apiCall } = await import('@/lib/api');
            const data = await apiCall(`/halan/orders/${order.id}/customer-cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: 'Customer requested cancellation from tracking page' })
            });

            if (data.success) {
                setActionMessage({ type: 'success', text: 'تم إلغاء الطلب بنجاح' });
                setShowCancelModal(false);
                fetchOrder();
            } else {
                setActionMessage({ type: 'error', text: data.error || 'فشل في إلغاء الطلب' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'حدث خطأ في الاتصال' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Remove item from order
    const handleRemoveItem = async (index: number, subId?: string | number, quantityToRemove?: number) => {
        if (!order || !canModify) return;
        setIsSubmitting(true);

        try {
            const { apiCall } = await import('@/lib/api');
            const data = await apiCall(`/halan/orders/${order.id}/customer-remove-item`, {
                method: 'POST',
                body: JSON.stringify({ itemIndex: index, bookingId: subId, quantityToRemove })
            });

            if (data.success) {
                setActionMessage({ type: 'success', text: 'تم حذف المنتج بنجاح' });
                fetchOrder();
            } else {
                setActionMessage({ type: 'error', text: data.error || 'فشل في حذف المنتج' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'حدث خطأ في الاتصال' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper to fix mangled UTF-8 text (Mojibake)
    // This handles the common case where UTF-8 bytes were interpreted as Windows-1256 or ISO-8859-1
    const fixMangledText = (str: string) => {
        if (!str) return str;
        try {
            // Check if string contains typical mojibake characters
            // Ø, Ù, etc. are common artifacts of UTF-8 interpreted as single-byte
            if (/[\u00C0-\u00FF]/.test(str)) {
                // Try treating as ISO-8859-1 -> UTF-8
                return decodeURIComponent(escape(str));
            }
            return str;
        } catch (e) {
            return str;
        }
    };

    // Calculate totals - prioritizing total_price if items are missing
    const itemsTotal = (order?.items && order.items.length > 0)
        ? order.items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0)
        : Math.max(0, (Number(order?.total_price || 0) - Number(order?.delivery_fee || 0)));

    const grandTotal = (Number(order?.total_price) || itemsTotal) + Number(order?.delivery_fee || 0);



    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col p-4 space-y-6" dir="rtl">
                {/* Skeleton Header */}
                <div className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-full animate-pulse" />
                    <div className="space-y-2">
                        <div className="w-24 h-4 bg-slate-800 rounded animate-pulse" />
                        <div className="w-16 h-3 bg-slate-800 rounded animate-pulse" />
                    </div>
                </div>

                {/* Skeleton Hero */}
                <div className="w-full h-48 bg-slate-800 rounded-3xl animate-pulse relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>

                {/* Skeleton Timeline */}
                <div className="bg-slate-800/50 rounded-2xl p-6 space-y-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-4 items-center">
                            <div className="w-8 h-8 bg-slate-700 rounded-full animate-pulse" />
                            <div className="w-32 h-4 bg-slate-700 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center p-4" dir="rtl">
                <div className="text-center">
                    <AlertCircle className="w-20 h-20 mx-auto text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">الطلب غير موجود</h1>
                    <p className="text-slate-400 mb-6">{error || 'تأكد من رابط التتبع الصحيح'}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition"
                    >
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    // 🚨 Detect Maintenance Orders - NO TRACKING FOR MAINTENANCE
    const MAINTENANCE_KEYWORDS = ['صيانة', 'سباكة', 'كهرباء', 'كهربائي', 'نجارة', 'دهانات', 'تكييف', 'maintenance', 'plumbing', 'electrical'];

    const hasMaintenanceKeyword = (text?: string) => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return MAINTENANCE_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
    };

    const isMaintenanceOrder =
        order.appointment_type === 'maintenance' ||
        order.status === 'pending_appointment' ||
        isMaintenanceProvider(order.category) ||
        isMaintenanceProvider(order.service_name) ||
        isMaintenanceProvider(order.provider_name) ||
        hasMaintenanceKeyword(order.service_name) ||
        hasMaintenanceKeyword(order.provider_name) ||
        hasMaintenanceKeyword(order.category);

    console.log('🔍 [/track/[id]] Maintenance Detection:', {
        orderId: order.id,
        appointmentType: order.appointment_type,
        status: order.status,
        serviceName: order.service_name,
        providerName: order.provider_name,
        category: order.category,
        isMaintenanceOrder
    });

    // 🟢 Alternative UI for Maintenance Orders
    if (isMaintenanceOrder) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-violet-950 dark:to-slate-900 text-slate-900 dark:text-white transition-colors duration-300" dir="rtl">
                {/* Header */}
                <div className="bg-white/80 dark:bg-black/30 backdrop-blur-lg border-b border-slate-200 dark:border-white/10 sticky top-0 z-40 transition-colors">
                    <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-900 dark:text-white" title="رجوع" aria-label="الرجوع للصفحة السابقة">
                            <ArrowRight className="w-6 h-6" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white">طلب صيانة</h1>
                        </div>
                        <button onClick={fetchOrder} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-900 dark:text-white" title="تحديث البيانات" aria-label="تحديث بيانات الطلب">
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="max-w-lg mx-auto p-4 space-y-6 pb-32">
                    {/* Appointment Status */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 p-6"
                    >
                        <div className="relative z-10 text-center">
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-24 h-24 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-4"
                            >
                                <Clock className="w-12 h-12 text-amber-400" />
                            </motion.div>
                            <h2 className="text-2xl font-black mb-2 text-amber-400">
                                في انتظار الموعد
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                                طلب صيانة يتطلب تحديد موعد للزيارة
                            </p>
                        </div>
                    </motion.div>

                    {/* Appointment Details */}
                    {order.appointment_date && (
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-violet-400" />
                                موعد الزيارة
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">
                                        {new Date(order.appointment_date).toLocaleDateString('ar-EG', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(order.appointment_date).toLocaleTimeString('ar-EG', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Service Details */}
                    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Package className="w-5 h-5 text-violet-400" />
                            تفاصيل الخدمة
                        </h3>
                        <div className="space-y-3">
                            {order.provider_name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">مقدم الخدمة</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{order.provider_name}</span>
                                </div>
                            )}
                            {order.service_name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">نوع الخدمة</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{order.service_name}</span>
                                </div>
                            )}
                            {order.delivery_address && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-600 dark:text-slate-400">العنوان</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{order.delivery_address}</span>
                                </div>
                            )}
                            {order.notes && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-600 dark:text-slate-400">ملاحظات</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{order.notes}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Phone className="w-5 h-5 text-green-400" />
                            معلومات التواصل
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">رقم الهاتف</p>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">{order.customer_phone}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    سيتم التواصل معك لتحديد موعد الزيارة في أقرب وقت ممكن
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-violet-950 dark:to-slate-900 text-slate-900 dark:text-white transition-colors duration-300" dir="rtl">
            {/* Action Message Toast */}
            <AnimatePresence>
                {actionMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-xl flex items-center gap-3 ${actionMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                            }`}
                    >
                        {actionMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-medium">{actionMessage.text}</span>
                        <button onClick={() => setActionMessage(null)} className="mr-auto" title="إغلاق التنبيه" aria-label="إغلاق التنبيه">
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="bg-white/80 dark:bg-black/30 backdrop-blur-lg border-b border-slate-200 dark:border-white/10 sticky top-0 z-40 transition-colors">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-900 dark:text-white" title="رجوع" aria-label="الرجوع للصفحة السابقة">
                        <ArrowRight className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            تتبع طلبك
                            {order && (
                                <span className="bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-sm text-slate-700 dark:text-slate-300">
                                    #{order.display_id || order.id}
                                </span>
                            )}
                        </h1>
                    </div>
                    <button onClick={fetchOrder} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-900 dark:text-white" title="تحديث البيانات" aria-label="تحديث بيانات الطلب">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-4 space-y-6 pb-32">
                {/* Status Hero - Premium Overhaul */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-white/5 p-8 shadow-2xl"
                >
                    {/* Dynamic Background Blobs */}
                    <div className="absolute inset-0 opacity-40">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600 rounded-full blur-[100px] animate-pulse" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] animate-pulse" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <motion.div
                            animate={{ 
                                scale: [1, 1.05, 1],
                                boxShadow: currentStatus.step === 5 
                                    ? ['0 0 0 0px rgba(34,197,94,0.4)', '0 0 0 20px rgba(34,197,94,0)']
                                    : ['0 0 0 0px rgba(139,92,246,0.4)', '0 0 0 20px rgba(139,92,246,0)']
                            }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className={`w-28 h-28 rounded-[2rem] ${currentStatus.bgColor} flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden`}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            <StatusIcon className="w-14 h-14 text-white relative z-10" />
                        </motion.div>
                        
                        <motion.h2 
                            layoutId="status-label"
                            className="text-3xl font-black mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
                        >
                            {currentStatus.label}
                        </motion.h2>
                        
                        {!['delivered', 'cancelled'].includes(normalizeTrackingStatus(order.status)) && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full backdrop-blur-md border border-white/10">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                </span>
                                <p className="text-violet-300 text-[11px] font-bold tracking-wider uppercase">
                                    تتبع مباشر
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Progress Timeline */}
                {normalizeTrackingStatus(order.status) !== 'cancelled' && (
                    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                        <h3 className="font-bold mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-violet-400" />
                            مراحل الطلب
                        </h3>
                        <div className="relative">
                            {/* Progress Line Background */}
                            <div className="absolute right-4 top-4 bottom-4 w-1 bg-slate-200 dark:bg-slate-700/50 rounded-full" />

                            {/* Animated Progress Line */}
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{
                                    height: `calc(${Math.min((currentStatus.step - 1) / 4, 1) * 100}% - ${currentStatus.step === 1 ? 0 : 0}px)`
                                }}
                                style={{
                                    maxHeight: 'calc(100% - 32px)',
                                    top: '16px',
                                    right: '16px'
                                }}
                                transition={{ duration: 1.5, ease: "easeInOut" }}
                                className={`absolute right-4 w-0.5 rounded-full origin-top transition-colors duration-1000 ${currentStatus.step >= 3 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gradient-to-b from-violet-500 to-green-500'}`}
                            />

                            {/* Timeline Steps */}
                            <div className="space-y-12 relative z-10">
                                {[
                                    { step: 1, label: 'تم استلام الطلب', icon: Package },
                                    { step: 2, label: 'جاري التحضير', icon: ChefHat },
                                    { step: 3, label: 'تم التحضير', icon: ChefHat },
                                    { step: 4, label: 'جاري التوصيل', icon: Store },
                                    { step: 5, label: 'تم التوصيل', icon: CheckCircle },
                                ].map((item, index, array) => {
                                    const StepIcon = item.icon;
                                    const isActive = currentStatus.step >= item.step;
                                    const isCurrent = currentStatus.step === item.step;
                                    const isLast = index === array.length - 1;

                                    return (
                                        <motion.div
                                            key={item.step}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: item.step * 0.1 }}
                                            className="flex items-center gap-6 relative"
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-700 ${isActive
                                                ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/40 scale-110'
                                                : 'bg-slate-800 text-slate-600'
                                                } ${isCurrent ? 'ring-4 ring-white/10' : ''} z-20`}>
                                                <StepIcon className="w-4 h-4" />
                                            </div>

                                            <div className="flex-1">
                                                <h4 className={`font-bold text-sm transition-colors duration-500 ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-600'}`}>
                                                    {item.label}
                                                </h4>
                                                {isCurrent && (
                                                    <motion.p
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className={`text-[10px] font-bold mt-1 ${item.step === 5 ? 'text-green-500' : 'text-slate-400'}`}
                                                    >
                                                        {item.step === 5 ? 'تم توصيل طلبك بنجاح!' : 'جاري الآن...'}
                                                    </motion.p>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modification Timer */}
                {canModify && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-amber-500/30 rounded-xl flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-amber-400">يمكنك التعديل أو الإلغاء</p>
                                <p className="text-sm text-amber-300/80">متبقي {formatTime(timeRemaining)} للتعديل</p>
                            </div>
                            <div className="text-2xl font-black text-amber-400">
                                {formatTime(timeRemaining)}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Parent Order Breakdown */}
                {order.is_parent && order.sub_orders && (
                    <div className="space-y-6">
                        <h3 className="font-bold text-xl px-2 flex items-center gap-2">
                            <Store className="w-6 h-6 text-violet-500" />
                            تفاصيل المتاجر ({order.sub_orders.length})
                        </h3>
                        {order.sub_orders.map((sub, sidx) => {
                            const sStatus = getStatusInfo(sub.status);
                            const SIcon = sStatus.icon;
                            return (
                                <motion.div
                                    key={sub.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: sidx * 0.1 }}
                                    className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
                                >
                                    {/* Sub-order Header */}
                                    <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                                        <div>
                                            <h4 className="font-bold text-lg">{fixMangledText(sub.provider_name)}</h4>
                                            <p className="text-xs text-slate-500">طلب فرعي #{sub.display_id || sub.id}</p>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold ${sStatus.color} ${sStatus.bgColor.replace('bg-', 'bg-opacity-10 ')}`}>
                                            <SIcon className="w-4 h-4" />
                                            {sStatus.label}
                                        </div>
                                    </div>

                                    {/* Sub-order Items */}
                                    <div className="p-5 space-y-3">
                                        {sub.items.map((item, iidx) => (
                                            <div key={iidx} className="flex justify-between items-center text-sm">
                                                <div className="flex gap-2">
                                                    <span className="font-bold text-violet-500">{item.quantity}x</span>
                                                    <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                                                </div>
                                                <span className="font-medium">{(item.price * item.quantity).toFixed(0)} ج.م</span>
                                            </div>
                                        ))}
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                            <span className="text-sm text-slate-500">إجمالي المتجر</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                {(() => {
                                                    if (Number(sub.price) > 0) return Number(sub.price).toFixed(0) + ' ج.م';
                                                    if (Array.isArray(sub.items) && sub.items.length > 0) {
                                                        const sum = sub.items.reduce((sum: number, i: any) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                                        return sum.toFixed(0) + ' ج.م';
                                                    }
                                                    return Number(sub.price || 0).toFixed(0) + ' ج.م';
                                                })()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sub-order Delivery Info */}
                                    {sub.courier_name && (
                                        <div className="px-5 pb-5">
                                            <div className="p-3 bg-green-500/10 rounded-2xl flex items-center gap-3 border border-green-500/20">
                                                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                                    <Truck className="w-5 h-5 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-green-600 font-bold uppercase">الطيار</p>
                                                    <p className="font-bold text-sm">{sub.courier_name}</p>
                                                </div>
                                                {sub.courier_phone && (
                                                    <a href={`tel:${sub.courier_phone}`} className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center" title="اتصال بالطيار" aria-label={`اتصال بالطيار ${sub.courier_name}`}>
                                                        <Phone className="w-5 h-5" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}

                        {/* Summary for Parent */}
                        <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-xl shadow-indigo-500/20">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-medium opacity-80">إجمالي جميع المتاجر</span>
                                <span className="text-2xl font-black">
                                    {(() => {
                                        if (Number(order.total_price) > 0) return Number(order.total_price).toFixed(0) + ' ج.م';
                                        if (Array.isArray(order.sub_orders)) {
                                            const sum = order.sub_orders.reduce((sum: number, s: any) => {
                                                if (Number(s.price) > 0) return sum + Number(s.price);
                                                const sItems = Array.isArray(s.items) ? s.items : [];
                                                return sum + sItems.reduce((is: number, i: any) => is + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                            }, 0);
                                            return sum.toFixed(0) + ' ج.م';
                                        }
                                        return Number(order.total_price || 0).toFixed(0) + ' ج.م';
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm opacity-90 mt-2 pt-3 border-t border-indigo-500/30">
                                <span>التوصيل</span>
                                <span>{Number(order.delivery_fee) > 0 ? `${Number(order.delivery_fee).toFixed(0)} ج.م` : 'يحدد من قبل المندوب'}</span>
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                                تم تجميع طلباتك في طلب واحد لتسهيل التتبع. قد يصل المندوبون في أوقات متقاربة حسب جاهزية كل متجر.
                            </div>
                        </div>
                    </div>
                )}

                {/* Standard View (for non-parent orders) */}
                {!order.is_parent && (
                    <>
                        {/* Order Items */}
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-violet-400" />
                                تفاصيل الطلب
                            </h3>
                            <div className="space-y-3">
                                {order.items?.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold shrink-0">
                                                {item.quantity}x
                                            </div>
                                            <div>
                                                <div className="flex items-center flex-wrap gap-1">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                                                    {item.freeQuantity && item.freeQuantity > 0 && (
                                                        <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                            + {item.freeQuantity} هدية
                                                        </span>
                                                    )}
                                                </div>
                                                {item.notes && <p className="text-xs text-slate-400">{item.notes}</p>}
                                            </div>
                                        </div>
                                        <span className="font-bold text-green-600 dark:text-green-400">{(Number(item.price) * (item.quantity || 1)).toFixed(0)} ج.م</span>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>المجموع</span>
                                    <span>{itemsTotal.toFixed(0)} ج.م</span>
                                </div>
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>التوصيل</span>
                                    <span>{Number(order.delivery_fee) > 0 ? `${Number(order.delivery_fee).toFixed(0)} ج.م` : 'يحدد من قبل المندوب'}</span>
                                </div>
                                <div className="flex justify-between text-slate-900 dark:text-white text-lg font-bold border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                                    <span>الإجمالي</span>
                                    <span>{grandTotal.toFixed(0)} ج.م</span>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Info */}
                        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                            <h3 className="font-bold flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-green-400" />
                                معلومات التوصيل
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">عنوان التوصيل</p>
                                        <p className="font-medium text-slate-800 dark:text-white">{fixMangledText(order.delivery_address)}</p>
                                    </div>
                                </div>
                                {order.courier_name && (
                                    <div className="flex items-center gap-3 p-3 bg-violet-500/10 rounded-xl">
                                        <div className="w-10 h-10 bg-violet-500/30 rounded-full flex items-center justify-center">
                                            <Truck className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-400">المندوب</p>
                                            <p className="font-bold text-slate-800 dark:text-white">{order.courier_name}</p>
                                        </div>
                                        {order.courier_phone && (
                                            <a href={`tel:${order.courier_phone}`} className="p-2 bg-green-500 rounded-full" title="اتصال بالطيار" aria-label={`اتصال بالطيار ${order.courier_name}`}>
                                                <Phone className="w-5 h-5" />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Structured Details from Notes (Maintenance/Custom Requests) */}
                {/* Simple Address & Notes Display */}
                <div className="bg-white dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none space-y-4">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-violet-400" />
                        عنوان التوصيل وتفاصيل الطلب
                    </h3>

                    {(() => {
                        // Windows-1252 special characters to Byte values (0x80 - 0x9F)
                        const w1252Map: { [key: number]: number } = {
                            0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E,
                            0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
                        };

                        const hasUnicode = (s: string) => { for (let i = 0; i < s.length; i++) { if (s.charCodeAt(i) > 255) return true; } return false; };

                        const fixAgony = (str: string) => {
                            if (!str) return "";
                            // If already valid Unicode (Arabic chars > U+00FF), return as-is
                            if (hasUnicode(str)) return str;
                            try {
                                // Convert string to bytes, handling Windows-1252 overrides
                                const bytes = new Uint8Array(str.length);
                                for (let i = 0; i < str.length; i++) {
                                    const code = str.charCodeAt(i);
                                    // If it's one of the Windows-1252 special chars, map it back to 0x80-0x9F
                                    if (w1252Map[code]) {
                                        bytes[i] = w1252Map[code];
                                    } else {
                                        // Otherwise just take the low byte (works for 00-7F and A0-FF)
                                        bytes[i] = code;
                                    }
                                }
                                // Attempt to decode as UTF-8
                                return new TextDecoder('utf-8').decode(bytes);
                            } catch (e) {
                                // Fallback to original string if decoding fails
                                return str;
                            }
                        };

                        // Apply fix
                        const rawAddress = order.delivery_address || "";
                        const rawNotes = order.notes || "";

                        const cleanAddress = fixAgony(rawAddress);
                        const cleanNotes = fixAgony(rawNotes);

                        return (
                            <div className="space-y-4 text-slate-800 dark:text-slate-200">
                                {/* Address Section */}
                                {cleanAddress && (
                                    <div>
                                        <p className="text-xs text-slate-400 mb-1">العنوان</p>
                                        <p className="font-bold text-lg leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/10">
                                            {cleanAddress}
                                        </p>
                                    </div>
                                )}

                                {/* Notes Section - Preserving formatting but cleaning pipes */}
                                {cleanNotes && (
                                    <div>
                                        <p className="text-xs text-slate-400 mb-1">ملاحظات</p>
                                        <div className="font-medium bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20 text-slate-700 dark:text-amber-100 leading-7">
                                            {cleanNotes.split('|').map((line, i) => (
                                                <p key={i} className={line.trim() ? "mb-1 last:mb-0" : ""}>
                                                    {line.trim()}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Premium Floating Actions */}
                <div className="fixed bottom-6 left-6 right-6 z-40 max-w-lg mx-auto">
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        className="glass-premium rounded-[2rem] p-3 flex gap-2 shadow-2xl border-white/20"
                    >
                        {/* Add Item Button */}
                        {canAddItems && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (order) router.push(`/explore?addToOrderId=${order.id}`);
                                }}
                                className="flex-1 py-4 bg-green-500 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:brightness-90 transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="hidden sm:inline">أضف للطلب</span>
                                <span className="sm:hidden text-xs">أضف</span>
                            </motion.button>
                        )}

                        {/* Edit Order Button */}
                        {canModify && order && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowEditModal(true)}
                                className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-2 transition-all backdrop-blur-md"
                            >
                                <Edit3 className="w-5 h-5" />
                                <span className="hidden sm:inline">تعديل</span>
                            </motion.button>
                        )}

                        {/* Cancel Button */}
                        {canModify && order && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowCancelModal(true)}
                                className="w-14 py-4 bg-red-500/10 text-red-500 rounded-[1.5rem] font-bold flex items-center justify-center transition-all border border-red-500/20"
                            >
                                <X className="w-6 h-6" />
                            </motion.button>
                        )}
                    </motion.div>
                </div>

                {/* Edit Order Modal */}
                <AnimatePresence>
                    {showEditModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
                            onClick={() => setShowEditModal(false)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
                            >
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white">تعديل الطلب</h3>
                                <p className="text-center text-slate-500 text-sm">يمكنك حذف العناصر وإضافة عناصر جديدة.</p>

                                <div className="space-y-3 mt-4">
                                    {(order?.is_parent ? (
                                        order.sub_orders?.flatMap(sub =>
                                            sub.items.map((item, idx) => ({ ...item, subId: sub.id, subName: sub.provider_name, subStatus: sub.status, originalIdx: idx }))
                                        )
                                    ) : (
                                        order?.items?.map((item, idx) => ({ ...item, subId: order.id, subName: order.provider_name, subStatus: order.status, originalIdx: idx }))
                                    ))?.map((item, i) => {
                                        const isItemLocked = ['ready_for_pickup', 'in_transit', 'delivered', 'cancelled'].includes(normalizeTrackingStatus(item.subStatus || order?.status || ''));
                                        return (
                                        <div key={i} className="flex flex-col gap-1">
                                            {item.subName && order?.is_parent && (
                                                <p className="text-[10px] text-violet-500 font-bold mr-1">{item.subName}</p>
                                            )}
                                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm shrink-0">
                                                        {item.quantity}x
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {(Number(item.price) * (item.quantity || 1)).toFixed(0)} ج.م
                                                        </p>
                                                    </div>
                                                </div>
                                                {!isItemLocked ? (
                                                    <div className="flex items-center gap-2">
                                                        {(item.quantity || 1) > 1 && (
                                                            <button
                                                                onClick={() => handleRemoveItem(item.originalIdx, item.subId, 1)}
                                                                disabled={isSubmitting}
                                                                className="p-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg transition-colors"
                                                                title="حذف قطعة واحدة"
                                                            >
                                                                <Minus className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveItem(item.originalIdx, item.subId)}
                                                            disabled={isSubmitting}
                                                            className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                                            title="حذف المنتج بالكامل"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">غير قابل للتعديل</span>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>

                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        if (order) router.push(`/explore?addToOrderId=${order.id}`);
                                    }}
                                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 mt-4"
                                >
                                    <Plus className="w-5 h-5" />
                                    أضف للطلب
                                </button>

                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                                >
                                    إغلاق
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Cancel Confirmation Modal */}
                <AnimatePresence>
                    {showCancelModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowCancelModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-sm bg-slate-900 rounded-3xl p-6 text-center space-y-4"
                            >
                                <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto flex items-center justify-center">
                                    <AlertCircle className="w-10 h-10 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold">إلغاء الطلب؟</h3>
                                <p className="text-slate-400">هل أنت متأكد أنك تريد إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.</p>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setShowCancelModal(false)}
                                        className="flex-1 py-3 bg-slate-800 rounded-xl font-bold hover:bg-slate-700 transition"
                                    >
                                        تراجع
                                    </button>
                                    <button
                                        onClick={handleCancelOrder}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3 bg-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            'تأكيد الإلغاء'
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

