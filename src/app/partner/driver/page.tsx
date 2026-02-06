"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Receipt,
    BarChart3,
    MapPin,
    Settings,
    LogOut,
    ClipboardList,
    RefreshCw,
    Map as MapIcon,
    List,
    Plus,
    PlusCircle,
    ArrowRight
} from "lucide-react";
import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";
import { useCourierTracking } from "@/components/providers/CourierTrackingProvider";
import dynamic from "next/dynamic";
import { Socket } from "socket.io-client";

// Dynamically import Leaflet components
const MapContainer = dynamic(
    () => import("react-leaflet").then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import("react-leaflet").then((mod) => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import("react-leaflet").then((mod) => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import("react-leaflet").then((mod) => mod.Popup),
    { ssr: false }
);

interface Order {
    id: number;
    customer_name: string;
    delivery_address: string;
    created_at: string;
    status: string;
    delivery_fee: number;
    items?: any;
    courier_id?: number | null;
}

const MAP_CENTER = { lat: 27.269, lng: 31.307 }; // New Assiut Center
// New Assiut city bounds - prevent zooming out past this area
const MAP_BOUNDS: [[number, number], [number, number]] = [
    [27.223, 31.256], // Southwest corner
    [27.315, 31.359]  // Northeast corner
];

export default function DriverDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const userRef = useRef<any>(null);

    // Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'list' | 'map'>('list');

    // Global Tracking
    const { isTracking, currentLocation, isExpired, startTracking } = useCourierTracking();
    const [trackingStarting, setTrackingStarting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);
        userRef.current = userData;

        // Redirect if not courier or partner_courier
        if (userData.role !== 'courier' && userData.role !== 'partner_courier') {
            router.push('/partner/dashboard');
            return;
        }

        fetchActiveOrders();

        // Poll for orders every 3 seconds
        const interval = setInterval(fetchActiveOrders, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveOrders = async () => {
        try {
            // Fetch ALL orders from the system - same endpoint the owner uses
            // This is more reliable for finding available orders
            const response = await apiCall('/halan/orders');

            if (response.success && Array.isArray(response.data)) {
                // Use ref to get current user without closure staleness
                const currentUser = userRef.current;

                const active = response.data.filter((o: any) => {
                    const isSelf = currentUser && o.courier_id === currentUser.id;
                    const isUnassigned = !o.courier_id;

                    // Driver should see:
                    // 1. Orders assigned to them that are not yet delivered
                    // 2. Unassigned orders that are waiting for a driver (pending or ready_for_pickup)
                    const isBroadcastStatus = ['pending', 'ready_for_pickup'].includes(o.status);
                    const isOngoingStatus = ['assigned', 'picked_up', 'in_transit'].includes(o.status);

                    return (isSelf && o.status !== 'delivered' && o.status !== 'cancelled') ||
                        (isUnassigned && isBroadcastStatus);
                }).map((o: any) => {
                    // Parse items safely
                    let items = o.items;
                    if (typeof items === 'string') {
                        try {
                            items = JSON.parse(items);
                        } catch {
                            items = [];
                        }
                    }
                    return { ...o, items: Array.isArray(items) ? items : [] };
                });

                // Sort by creation date descending
                active.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setActiveOrders(active);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleAcceptOrder = async (orderId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.id) return;

        try {
            // Find current status to avoid status regression (Stage 3 -> Stage 2)
            const currentOrder = activeOrders.find(o => o.id === orderId);
            const newStatus = currentOrder?.status === 'ready_for_pickup' ? 'ready_for_pickup' : 'assigned';

            const result = await apiCall(`/halan/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: newStatus,
                    courier_id: user.id,
                    courier_name: user.name_ar || user.name
                })
            });

            if (result.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم قبول الطلب',
                    message: 'لقد قمت باستلام الطلب بنجاح. يرجى التوجه لمقر المتجر.',
                    type: 'success'
                });
                setTimeout(fetchActiveOrders, 500);
            }
        } catch (error: any) {
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: error.message || 'فشل قبول الطلب',
                type: 'error'
            });
        }
    };

    const handlePickupOrder = async (orderId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await apiCall(`/halan/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'picked_up' })
            });

            if (result.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم الاستلام',
                    message: 'تم تحديث حالة الطلب بنجاح. بدأت عملية التوصيل.',
                    type: 'success'
                });
                // Refresh orders after a short delay
                setTimeout(fetchActiveOrders, 500);
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: result.error || 'حدث خطأ أثناء تحديث الطلب',
                    type: 'error'
                });
            }
        } catch (error: any) {
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: error.message || 'حدث خطأ أثناء تحديث الطلب',
                type: 'error'
            });
        }
    };

    const handleDeliverOrder = async (orderId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await apiCall(`/halan/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'delivered' })
            });

            if (result.success) {
                setModalState({
                    isOpen: true,
                    title: 'تم التوصيل',
                    message: 'تم تسليم الطلب بنجاح. شكراً لخدمتك!',
                    type: 'success'
                });
                // Refresh orders after a short delay
                setTimeout(fetchActiveOrders, 500);
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: result.error || 'حدث خطأ أثناء تحديث الطلب',
                    type: 'error'
                });
            }
        } catch (error: any) {
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: error.message || 'حدث خطأ أثناء تحديث الطلب',
                type: 'error'
            });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('halan_token');
        localStorage.removeItem('halan_user');
        localStorage.removeItem('location_activation_expiry');
        router.push('/login/partner');
    };

    const createMyIcon = () => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            return L.divIcon({
                html: `
                    <div style="
                        width: 30px; 
                        height: 30px; 
                        background: #624AF2;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 0 10px rgba(98, 74, 242, 0.5);
                    "></div>
                `,
                className: 'my-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
        }
        return undefined;
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background text-foreground font-cairo flex flex-col transition-colors duration-500" dir="rtl">
            {/* Midnight Violet Header - Driver */}
            <div
                className="p-8 pt-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#1E1B4B] to-[#4338CA] border-b border-white/5"
            >
                {/* Decorative Elements */}
                <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-violet-500/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-20%] right-[-5%] w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4 text-right">
                            <div className="relative">
                                <img
                                    src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name_ar || user?.name || 'U')}&background=8b5cf6&color=fff`}
                                    alt={user?.name_ar}
                                    className="w-16 h-16 rounded-2xl border-2 border-white/20 object-cover shadow-xl"
                                />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[#1E1B4B] rounded-full shadow-lg" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white drop-shadow-sm">الطلبات الحالية</h1>
                                <p className="text-white/60 text-sm">مرحباً، <span className="text-violet-200 font-bold">{user?.name_ar || user?.name}</span></p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/partner/settings')}
                                title="الإعدادات"
                                className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleLogout}
                                title="تسجيل الخروج"
                                className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-all border border-red-500/20 shadow-lg"
                            >
                                <LogOut className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Add Order - Themed */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-6"
                    >
                        <button
                            onClick={() => router.push('/partner/orders/create')}
                            className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex items-center justify-between transition-all group shadow-xl"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
                                    <PlusCircle className="w-7 h-7 text-emerald-400" />
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-bold text-lg">إضافة طلب خارجي</p>
                                    <p className="text-white/40 text-xs">سجل طلبك وثبّت بياناته الآن</p>
                                </div>
                            </div>
                            <ArrowRight className="w-6 h-6 text-white/30 -rotate-180 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                        </button>
                    </motion.div>

                    {/* Tracking Status Indicator - Themed */}
                    <div className="flex items-center justify-center gap-3 bg-black/30 backdrop-blur-xl px-5 py-2.5 rounded-2xl mb-6 border border-white/5 shadow-inner">
                        <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'} ${!isTracking && 'animate-pulse'}`} />
                        <span className="text-white/80 text-sm font-bold tracking-tight">
                            {isTracking ? 'التتبع نشط (صالح لمدة 24 ساعة)' : 'التتبع متوقف حالياً'}
                        </span>
                    </div>

                    {/* View Toggles - Midnight Theme */}
                    <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-2xl">
                        <button
                            onClick={() => setView('list')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'list'
                                ? 'bg-white text-indigo-950 shadow-xl scale-100'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <List className="w-4 h-4" />
                            قائمة الطلبات
                        </button>
                        <button
                            onClick={() => setView('map')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'map'
                                ? 'bg-white text-indigo-950 shadow-xl scale-100'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <MapIcon className="w-4 h-4" />
                            خريطة التوصيل
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col w-full">
                {view === 'list' ? (
                    <div className="p-6 pb-12">
                        {/* Quick Action Buttons - Midnight */}
                        <div className="grid grid-cols-1 gap-4 mb-10">
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                onClick={() => router.push('/partner/orders')}
                                className="w-full flex items-center justify-between gap-4 bg-card/40 border-border/10 shadow-lg hover:border-primary/30 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform">
                                        <Receipt className="w-6 h-6 text-orange-400" />
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-lg text-foreground block">طلباتي السابقة</span>
                                        <span className="text-xs text-slate-500">مراجعة الأرشيف والمحفظة</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 text-slate-600 -rotate-180 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </motion.button>

                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                onClick={() => router.push('/partner/stats')}
                                className="w-full flex items-center justify-between gap-4 bg-card/40 border-border/10 shadow-lg hover:border-primary/30 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 group-hover:scale-110 transition-transform">
                                        <BarChart3 className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-lg text-foreground block">تقارير الأداء</span>
                                        <span className="text-xs text-slate-500">تحليل الدخل والإنتاجية</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 text-slate-600 -rotate-180 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </motion.button>
                        </div>

                        {/* Active Orders Section */}
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <span className="w-1 h-6 bg-violet-500 rounded-full" />
                                طلبات نشطة ({activeOrders.length})
                            </h2>
                            <button
                                onClick={fetchActiveOrders}
                                title="تحديث الطلبات"
                                className="p-2.5 rounded-2xl bg-muted border border-border hover:bg-muted/80 transition-all"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-slate-500 text-sm animate-pulse font-medium">جاري التحديث...</p>
                            </div>
                        ) : activeOrders.length === 0 ? (
                            <div className="text-center py-20 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/10 mx-2 shadow-inner">
                                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <ClipboardList className="w-10 h-10 text-slate-600" />
                                </div>
                                <p className="text-foreground font-bold text-lg mb-2">لا توجد طلبات جارية</p>
                                <p className="text-slate-500 text-sm px-10">استمتع باستراحة، سنخبرك فور وصول طلب جديد.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activeOrders.map((order, idx) => (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => router.push(`/partner/orders/${order.id}`)}
                                        className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 shadow-xl hover:border-violet-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-violet-400 tracking-wider">
                                                    #{order.id}
                                                </span>
                                                <span className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400">
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-[10px] font-bold">
                                                {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        <div className="text-right mb-6">
                                            <h3 className="text-foreground font-bold text-xl group-hover:text-violet-400 transition-colors mb-2">{order.customer_name}</h3>
                                            <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-300 transition-colors">
                                                <MapPin className="w-4 h-4 text-violet-500 flex-shrink-0" />
                                                <span className="text-sm truncate font-medium">{order.delivery_address}</span>
                                            </div>
                                        </div>

                                        {/* Live Items List */}
                                        {order.items && order.items.length > 0 && (
                                            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5">
                                                <p className="text-[10px] text-slate-500 font-black mb-2 flex items-center gap-2">
                                                    <ClipboardList className="w-3 h-3" /> المنتجات ({order.items.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {order.items.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-xs font-bold">
                                                            <span className="text-slate-300">x{item.quantity} {item.name || item.product_name}</span>
                                                            <span className="text-violet-400">{item.price || item.unit_price} ج.م</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-5 border-t border-white/5 mb-4">
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">صافي الربح المتوقع</p>
                                                <p className="text-2xl font-black text-emerald-400 leading-none">{parseFloat(order.delivery_fee?.toString() || '0').toFixed(0)} <span className="text-xs font-bold text-emerald-500/60 mr-1">ج.م</span></p>
                                            </div>
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-violet-500 group-hover:text-foreground transition-all shadow-lg">
                                                <ArrowRight className="w-5 h-5 -rotate-180" />
                                            </div>
                                        </div>

                                        {/* Action Buttons for Courier */}
                                        <div className="flex gap-3 pt-4 border-t border-white/5">
                                            {(order.status === 'pending' || order.status === 'ready_for_pickup') && !order.courier_id && (
                                                <motion.button
                                                    onClick={(e) => handleAcceptOrder(order.id, e)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-violet-500/30 text-sm"
                                                >
                                                    قبول واستلام الطلب
                                                </motion.button>
                                            )}
                                            {(order.status === 'assigned' || (order.status === 'ready_for_pickup' && order.courier_id)) && (
                                                <motion.button
                                                    onClick={(e) => handlePickupOrder(order.id, e)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/30 text-sm"
                                                >
                                                    تم الاستلام
                                                </motion.button>
                                            )}
                                            {order.status === 'picked_up' && (
                                                <motion.button
                                                    onClick={(e) => handleDeliverOrder(order.id, e)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 text-sm"
                                                >
                                                    تم التوصيل
                                                </motion.button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Existing Map View */
                    <div className="flex-1 relative bg-[#020617]">
                        <div className="absolute inset-0 z-0">
                            <MapContainer
                                center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [MAP_CENTER.lat, MAP_CENTER.lng]}
                                zoom={15}
                                minZoom={12}
                                maxBounds={MAP_BOUNDS}
                                maxBoundsViscosity={1.0}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />

                                {currentLocation && (
                                    <Marker position={[currentLocation.lat, currentLocation.lng]} icon={createMyIcon()}>
                                        <Popup>موقعك الحالي</Popup>
                                    </Marker>
                                )}
                            </MapContainer>
                        </div>

                        {/* Overlay Cards - Themed */}
                        <div className="absolute bottom-6 left-4 right-4 z-[500] flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
                            {activeOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-[#0F172A]/90 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl min-w-[280px] snap-center cursor-pointer border border-white/10 hover:border-violet-500/50 transition-all flex flex-col gap-2"
                                    onClick={() => router.push(`/partner/orders/${order.id}`)}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-tighter">طلب #{order.id}</span>
                                        <span className="text-[10px] font-bold text-emerald-400">{order.delivery_fee} ج.م</span>
                                    </div>
                                    <p className="font-bold text-foreground text-base truncate">{order.customer_name}</p>
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-violet-500" />
                                        {order.delivery_address}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <StatusModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />
        </div>
    );
}
