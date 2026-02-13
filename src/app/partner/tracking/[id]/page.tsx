"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { ArrowRight, Phone, User, MapPin, Wifi, WifiOff, RefreshCw, LayoutDashboard, Map as MapIcon, Calendar, CheckCircle, TrendingUp, DollarSign, Star } from "lucide-react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { apiCall } from "@/lib/api";

// Dynamically import Leaflet to avoid SSR issues
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
// We need to access useMap in a way that doesn't break SSR. 
// However, since it's a hook used inside a component, we can't dynamic import the hook itself easily.
// The standard workaround is to create the component in a separate file or use a dynamic import for the component using it.
// But here, we can try importing it from the module if we are sure it's client-side only. 
// A safer bet in this specific setup (where everything is dynamic) is to create a dynamic component for RecenterMap.
const MapController = dynamic(
    () => import("react-leaflet").then((mod) => {
        const { useMap, useMapEvents } = mod;
        return function MapController({ location, isFollowing, onUserInteraction }: any) {
            const map = useMap();

            useMapEvents({
                dragstart: () => {
                    onUserInteraction();
                },
                zoomstart: () => {
                    onUserInteraction();
                }
            });

            useEffect(() => {
                if (location && isFollowing) {
                    map.flyTo([location.lat, location.lng], 16, { animate: true, duration: 1.5 });
                }
            }, [location, isFollowing, map]);
            return null;
        };
    }),
    { ssr: false }
);

import StatusModal from "@/components/ui/status-modal";

// New Assiut City center
const MAP_CENTER = { lat: 27.269, lng: 31.307 };
const MAP_BOUNDS = [[27.223, 31.256], [27.315, 31.359]];

interface DriverLocation {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
}

export default function DriverTrackingPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const driverId = params.id as string;
    const driverName = searchParams.get('name') || 'المندوب';
    const driverUsername = searchParams.get('username') || '';

    const [user, setUser] = useState<any>(null);
    const [location, setLocation] = useState<DriverLocation | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [activeTab, setActiveTab] = useState<'map' | 'details'>('map');
    const [driverStats, setDriverStats] = useState({
        totalOrders: 0,
        delivered: 0,
        rating: 0.0,
        earnings: 0,
        joinedDate: '-'
    });
    const [isFollowing, setIsFollowing] = useState(true);
    const [driverData, setDriverData] = useState<any>(null);

    // Status Modal State
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

    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        fetchDriverData();
    }, [driverId]);

    const fetchDriverData = async () => {
        try {
            // 1. Fetch User Data
            const userData = await apiCall(`/halan/users/${driverId}`);
            let joinedDate = new Date().toLocaleDateString('en-CA');

            if (userData.success) {
                setDriverData(userData.data);
                if (userData.data.createdAt || userData.data.created_at) {
                    joinedDate = new Date(userData.data.createdAt || userData.data.created_at).toLocaleDateString('en-CA');
                }
            }

            // 2. Fetch Orders for Stats
            const ordersData = await apiCall(`/halan/orders?courierId=${driverId}`);
            if (ordersData.success) {
                const orders = ordersData.data;
                const deliveredOrders = orders.filter((o: any) => o.status === 'delivered');

                setDriverStats({
                    totalOrders: orders.length,
                    delivered: deliveredOrders.length,
                    rating: 0.0,
                    earnings: deliveredOrders.reduce((sum: number, o: any) => sum + Number(o.delivery_fee || 0), 0),
                    joinedDate: joinedDate
                });
            }
        } catch (error) {
            console.error('Error fetching driver data:', error);
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        setUser(JSON.parse(storedUser));

        setMapReady(true);

        // Connect to socket for real-time tracking
        connectSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [driverUsername]);

    const connectSocket = () => {
        setConnectionStatus('connecting');

        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current.on('connect', () => {
            console.log('🟢 Socket connected for tracking');
            setIsConnected(true);
            setConnectionStatus('connected');

            // Join tracking room for this driver
            // IMPORTANT: Server uses numeric driverId for room naming (driver-30 format)
            if (driverId) {
                console.log('Joining tracking for driver ID:', driverId);
                socketRef.current?.emit('join-driver-tracking', driverId);
            } else {
                console.error('No driver ID provided for tracking');
            }
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔴 Socket disconnected');
            setIsConnected(false);
            setConnectionStatus('disconnected');
        });

        socketRef.current.on('connect_error', (error: Error) => {
            console.error('Socket connection error:', error);
            setConnectionStatus('disconnected');
        });

        // Listen for standard location updates from server (this is what the server emits)
        socketRef.current.on('updateLocation', (data: any) => {
            console.log('📍 Received updateLocation:', data);
            const lat = data.latitude || data.lat;
            const lng = data.longitude || data.lng;

            if (lat !== undefined && lng !== undefined) {
                setLocation({
                    lat,
                    lng,
                    heading: data.heading || 0,
                    speed: data.speed || 0,
                    timestamp: Date.now()
                });
                setLastUpdate(new Date());
            }
        });

        // Listen for driver location updates (legacy/fallback)
        socketRef.current.on('driver-location', (data: any) => {
            console.log('📍 Received driver location:', data);
            if (data.driverId === driverUsername || data.courierId === driverUsername) {
                const lat = data.lat || data.latitude;
                const lng = data.lng || data.longitude;

                if (lat !== undefined && lng !== undefined) {
                    setLocation({
                        lat,
                        lng,
                        heading: data.heading || 0,
                        speed: data.speed || 0,
                        timestamp: Date.now()
                    });
                    setLastUpdate(new Date());
                }
            }
        });

        // Also listen for location-update event (different apps might use different event names)
        socketRef.current.on('location-update', (data: any) => {
            console.log('📍 Received location update:', data);
            if (data.driverId === driverUsername || data.courierId === driverUsername) {
                const lat = data.lat || data.latitude;
                const lng = data.lng || data.longitude;

                if (lat !== undefined && lng !== undefined) {
                    setLocation({
                        lat,
                        lng,
                        heading: data.heading || 0,
                        speed: data.speed || 0,
                        timestamp: Date.now()
                    });
                    setLastUpdate(new Date());
                }
            }
        });
    };

    const handleCallDriver = () => {
        // In a real app, you'd get the driver's phone number from the API
        window.open(`tel:+201234567890`, '_blank');
    };

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'bg-green-500';
            case 'connecting': return 'bg-yellow-500';
            case 'disconnected': return 'bg-red-500';
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connected': return 'متصل';
            case 'connecting': return 'جارٍ الاتصال...';
            case 'disconnected': return 'غير متصل';
        }
    };

    // Create custom driver icon
    const createDriverIcon = () => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            return L.divIcon({
                html: `
                    <div style="
                        width: 40px; 
                        height: 40px; 
                        background: ${isConnected ? '#4CAF50' : '#F44336'};
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <div style="
                            width: 0;
                            height: 0;
                            border-left: 8px solid transparent;
                            border-right: 8px solid transparent;
                            border-bottom: 14px solid white;
                            margin-bottom: 4px;
                        "></div>
                    </div>
                `,
                className: 'driver-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
        }
        return undefined;
    };

    const handleOpenGoogleMaps = () => {
        if (location) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`, '_blank');
        } else {
            setModalState({
                isOpen: true,
                title: 'انتظر قليلاً',
                message: 'لم يتم تحديث الموقع بعد، يرجى الانتظار...',
                type: 'info'
            });
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-slate-100 dark:bg-slate-950 overflow-hidden" dir="rtl">
            {/* Header */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg flex-shrink-0 z-10 relative"
                style={{
                    background: 'linear-gradient(135deg, #624AF2 0%, #504DFF 100%)'
                }}
            >
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => router.back()} className="p-2">
                        <ArrowRight className="w-6 h-6 text-white" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">ملف المندوب</h1>
                        <p className="text-white/80 text-sm">{driverName}</p>
                    </div>
                    <div className="flex gap-2">

                        <button
                            onClick={handleCallDriver}
                            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <Phone className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-black/20 p-1 rounded-xl mb-2">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'map'
                            ? 'bg-white text-violet-600 shadow-sm'
                            : 'text-white/70 hover:bg-white/10'
                            }`}
                    >
                        <MapIcon className="w-4 h-4" />
                        الخريطة الحية
                    </button>
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'details'
                            ? 'bg-white text-violet-600 shadow-sm'
                            : 'text-white/70 hover:bg-white/10'
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        الإحصائيات
                    </button>
                </div>

                {/* Connection Status Helper (Only show on Map Tab) */}
                {activeTab === 'map' && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                        <span className="text-white/90 text-xs font-medium">{getStatusText()}</span>
                        {connectionStatus === 'disconnected' && (
                            <button onClick={connectSocket} className="mr-1">
                                <RefreshCw className="w-3 h-3 text-white/80" />
                            </button>
                        )}
                    </div>
                )}
            </div>



            {/* Content Area */}
            <div className="flex-1 relative w-full h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
                {/* Map View - Keep mounted using hidden class to preserve connection/state */}
                <div className={`w-full h-full relative ${activeTab === 'map' ? 'block' : 'hidden'}`}>
                    {mapReady && (
                        <MapContainer
                            key={`map-${driverId}`}
                            center={location ? [location.lat, location.lng] : [MAP_CENTER.lat, MAP_CENTER.lng]}
                            zoom={15}
                            minZoom={13}
                            maxBounds={MAP_BOUNDS as any}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />

                            <MapController
                                location={location}
                                isFollowing={isFollowing}
                                onUserInteraction={() => setIsFollowing(false)}
                            />

                            {/* Recenter Button */}
                            <div className="absolute top-4 left-4 z-[1000]">
                                <button
                                    onClick={() => setIsFollowing(true)}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${isFollowing
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200'
                                        }`}
                                >
                                    <MapPin className={`w-6 h-6 ${isFollowing ? 'animate-pulse' : ''}`} />
                                </button>
                            </div>

                            {location && (
                                <Marker
                                    position={[location.lat, location.lng]}
                                    icon={createDriverIcon()}
                                >
                                    <Popup>
                                        <div className="text-center p-2">
                                            <p className="font-bold">{driverName}</p>
                                            {location.speed !== undefined && (
                                                <p className="text-sm text-slate-600">السرعة: {Math.round(location.speed * 3.6)} كم/س</p>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            )}
                        </MapContainer>
                    )}
                </div>

                {/* Details/Stats View */}
                {activeTab !== 'map' && (
                    <div className="w-full h-full overflow-y-auto p-4 space-y-4">
                        {/* Driver Profile Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-4">
                                <img
                                    src={driverData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driverName)}&background=random&size=100`}
                                    alt={driverName}
                                    className="w-20 h-20 rounded-full object-cover border-4 border-violet-100 dark:border-violet-900"
                                />
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{driverName}</h2>
                                    <p className="text-slate-500 dark:text-slate-400">@{driverUsername}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-sm text-slate-500">{isConnected ? 'متصل الآن' : 'غير متصل'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">{driverStats.delivered}</p>
                                <p className="text-xs text-slate-500">طلبات تم توصيلها</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mb-2">
                                    <TrendingUp className="w-5 h-5 text-violet-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">{driverStats.totalOrders}</p>
                                <p className="text-xs text-slate-500">إجمالي الطلبات</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-2">
                                    <Star className="w-5 h-5 text-amber-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">{driverStats.rating}</p>
                                <p className="text-xs text-slate-500">التقييم</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2">
                                    <DollarSign className="w-5 h-5 text-emerald-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">{driverStats.earnings}</p>
                                <p className="text-xs text-slate-500">الأرباح (ج.م)</p>
                            </div>
                        </div>

                        {/* Join Date */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">تاريخ الانضمام</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{driverStats.joinedDate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Current Location */}
                        {location && (
                            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-5 h-5" />
                                    <span className="font-bold">الموقع الحالي</span>
                                </div>
                                <p className="text-white/80 text-sm">
                                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                </p>
                                {lastUpdate && (
                                    <p className="text-white/60 text-xs mt-1">
                                        آخر تحديث: {lastUpdate.toLocaleTimeString('ar-EG')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Driver Info Overlay - Only show on Map Tab */}
                {activeTab === 'map' && (
                    <div className="absolute bottom-4 right-4 left-4 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg z-[500]">
                        <div className="flex items-center gap-3">
                            <img
                                src={driverData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driverName)}&background=random`}
                                alt={driverName}
                                className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700"
                            />
                            <div className="flex-1">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{driverName}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">@{driverUsername}</p>
                            </div>
                            <div className="text-left">
                                {lastUpdate ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        آخر تحديث: {lastUpdate.toLocaleTimeString('ar-EG')}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {location ? <span className="text-green-600 dark:text-green-400">موقع نشط</span> : 'في انتظار الموقع...'}
                                    </p>
                                )}
                                {location && typeof location.lat === 'number' && typeof location.lng === 'number' && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                        <MapPin className="w-3 h-3" />
                                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* No Location Warning */}
                {activeTab === 'map' && !location && connectionStatus === 'connected' && (
                    <div className="absolute top-4 right-4 left-4 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-xl p-3 flex items-center gap-2 z-[500]">
                        <WifiOff className="w-5 h-5" />
                        <span className="text-sm">المندوب لم يفعّل التتبع بعد أو خارج النطاق</span>
                    </div>
                )}
                <StatusModal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                    title={modalState.title}
                    message={modalState.message}
                    type={modalState.type}
                />
            </div >
        </div >
    );
}
