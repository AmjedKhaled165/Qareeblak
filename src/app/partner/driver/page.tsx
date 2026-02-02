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
import { useCourierTracking } from "@/providers/courier-tracking-provider";
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
            const data = await apiCall('/halan/orders/courier');

            if (data.success && Array.isArray(data.data)) {
                const active = data.data.filter((o: any) =>
                    ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status)
                );
                setActiveOrders(active);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setIsLoading(false);
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col" dir="rtl">
            {/* Violet Gradient Header - Driver */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg flex-shrink-0"
                style={{
                    background: 'linear-gradient(135deg, #624AF2 0%, #504DFF 100%)'
                }}
            >
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3 text-right">
                        <img
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name_ar || user?.name || 'U')}&background=random`}
                            alt={user?.name_ar}
                            className="w-12 h-12 rounded-full border-2 border-white/30 object-cover"
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">الطلبات الحالية</h1>
                            <p className="text-white/80 text-sm">مرحباً، {user?.name_ar || user?.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push('/partner/settings')}
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <Settings className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <LogOut className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Add Order Quick Box */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2"
                >
                    <button
                        onClick={() => router.push('/partner/orders/create')}
                        className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 flex items-center justify-between transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center">
                                <PlusCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div className="text-right">
                                <p className="text-white font-bold">إضافة طلب خارجي</p>
                                <p className="text-white/60 text-xs text-right">أضف طلب جديد واستلم بياناته فوراً</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/40 -rotate-180" />
                    </button>
                </motion.div>

                {/* Tracking Status Indicator */}
                <div
                    className="mx-auto flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-4"
                >
                    <div className={`w-2.5 h-2.5 rounded-full ${isTracking ? 'bg-green-400' : 'bg-red-400'} ${!isTracking && 'animate-pulse'}`} />
                    <span className="text-white text-sm font-medium">
                        {isTracking ? 'التتبع نشط (صالح لمدة 24 ساعة)' : 'التتبع متوقف'}
                    </span>
                </div>

                {/* View Toggles */}
                <div className="flex bg-black/20 p-1 rounded-xl">
                    <button
                        onClick={() => setView('list')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'list'
                            ? 'bg-white text-violet-600 shadow-sm'
                            : 'text-white/70 hover:bg-white/10'
                            }`}
                    >
                        <List className="w-4 h-4" />
                        الطلبات
                    </button>
                    <button
                        onClick={() => setView('map')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'map'
                            ? 'bg-white text-violet-600 shadow-sm'
                            : 'text-white/70 hover:bg-white/10'
                            }`}
                    >
                        <MapIcon className="w-4 h-4" />
                        الخريطة
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
                {view === 'list' ? (
                    <div className="p-4 pb-8">
                        {/* Quick Action Buttons */}
                        <div className="space-y-3 mb-6">
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                onClick={() => router.push('/partner/orders')}
                                className="w-full flex items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                        <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">عرض طلباتي السابقة</span>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 -rotate-180" />
                            </motion.button>

                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                onClick={() => router.push('/partner/stats')}
                                className="w-full flex items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">تقارير الأداء والدخل</span>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 -rotate-180" />
                            </motion.button>
                        </div>

                        {/* Active Orders Section */}
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">طلبات نشطة ({activeOrders.length})</h2>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : activeOrders.length === 0 ? (
                            <div className="text-center py-12">
                                <ClipboardList className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-500 dark:text-slate-400">لا توجد طلبات حالياً</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeOrders.map((order) => (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => router.push(`/partner/orders/${order.id}`)}
                                        className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-bold text-slate-800 dark:text-slate-100">طلب #{order.id}</span>
                                            <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-semibold">
                                                نشط
                                            </span>
                                        </div>
                                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">{order.customer_name}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-2 flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {order.delivery_address}
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <p className="text-slate-400 text-xs">
                                                {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <div className="text-left">
                                                {(() => {
                                                    const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
                                                    const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
                                                    const deliFee = parseFloat(order.delivery_fee?.toString() || '0');
                                                    const grandTotal = itemsTotal + deliFee;

                                                    if (grandTotal === 0 && deliFee === 0) return null;

                                                    return (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-green-600 dark:text-green-400 text-lg leading-none">
                                                                {grandTotal.toFixed(0)} ج.م
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 mt-1">
                                                                + {deliFee} توصيل
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 relative bg-slate-200 dark:bg-slate-900">
                        {/* Map View */}
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
                                        <Popup>
                                            <div className="text-center">
                                                <p className="font-bold">موقعك الحالي</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                            </MapContainer>
                        </div>

                        {/* Order Cards Overlay */}
                        <div className="absolute bottom-4 left-4 right-4 z-[500] flex gap-3 overflow-x-auto pb-2 snap-x">
                            {activeOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg min-w-[250px] snap-center cursor-pointer border-l-4 border-violet-500"
                                    onClick={() => router.push(`/partner/orders/${order.id}`)}
                                >
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">طلب #{order.id}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{order.delivery_address}</p>
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
