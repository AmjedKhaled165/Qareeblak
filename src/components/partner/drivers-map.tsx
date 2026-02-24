"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import dynamic from "next/dynamic";
import { User, Navigation } from "lucide-react";

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

interface DriverLocation {
    driverId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp: number;
    name?: string;
}

interface DriversMapProps {
    user?: any;
}

const MAP_CENTER = { lat: 27.269, lng: 31.307 }; // New Assiut Center

export default function DriversMap({ user }: DriversMapProps) {
    const [drivers, setDrivers] = useState<Record<string, DriverLocation>>({});
    const [isConnected, setIsConnected] = useState(false);
    const [allowedDriverIds, setAllowedDriverIds] = useState<Set<string> | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Fetch assigned drivers for managers (supervisors) or all available drivers for owners
    useEffect(() => {
        const fetchAvailableDrivers = async () => {
            try {
                const token = localStorage.getItem('halan_token');
                let url = `${process.env.NEXT_PUBLIC_API_URL || ''}/halan/users?role=courier`;

                if (user?.role === 'supervisor') {
                    url += `&supervisorId=${user.id}`;
                }

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                console.log('🔍 Drivers API response:', data);

                if (data.success) {
                    // Only include drivers that are available (isAvailable = true)
                    const availableDrivers = data.data.filter((d: any) => d.isAvailable === true);
                    const ids = new Set<string>(availableDrivers.map((d: any) => String(d.id)));
                    console.log('🔍 Available driver IDs:', [...ids]);
                    setAllowedDriverIds(ids);
                }
            } catch (e) {
                console.error("Failed to fetch drivers", e);
            }
        };

        if (user) {
            fetchAvailableDrivers();
        }
    }, [user]);

    useEffect(() => {
        // Connect to socket
        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('🟢 Map socket connected');
            setIsConnected(true);

            // Join managers room to get all updates
            socketRef.current?.emit('join-managers');
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔴 Map socket disconnected');
            setIsConnected(false);
        });

        // Listen for ANY driver location update
        const handleLocationUpdate = (data: any) => {
            console.log('📍 Socket location update received:', data);
            // Normalize data
            const driverId = data.driverId || data.courierId || 'unknown';
            const lat = data.lat || data.latitude;
            const lng = data.lng || data.longitude;

            // Only update if we have valid coordinates
            if (lat !== undefined && lng !== undefined) {
                const location: DriverLocation = {
                    driverId,
                    lat,
                    lng,
                    heading: data.heading,
                    speed: data.speed,
                    timestamp: Date.now(),
                    name: data.name // Backend might send name
                };

                setDrivers(prev => ({
                    ...prev,
                    [driverId]: location
                }));
            }
        };

        socketRef.current.on('driver-status-changed', (data: { driverId: string, status: string, isAvailable?: boolean }) => {
            console.log('🔄 Driver status changed:', data);

            // If the event specifically tells us about availability
            if (data.isAvailable !== undefined) {
                setAllowedDriverIds(prev => {
                    if (!prev) return prev;
                    const newIds = new Set(prev);
                    if (data.isAvailable) {
                        newIds.add(String(data.driverId));
                    } else {
                        newIds.delete(String(data.driverId));
                        // Remove from map state immediately
                        setDrivers(dprev => {
                            const updated = { ...dprev };
                            delete updated[data.driverId];
                            delete updated[String(data.driverId)];
                            return updated;
                        });
                    }
                    return newIds;
                });
            } else if (data.status === 'online') {
                setDrivers(prev => {
                    const driver = prev[data.driverId];
                    if (driver) {
                        return {
                            ...prev,
                            [data.driverId]: { ...driver, timestamp: Date.now() }
                        };
                    }
                    return prev;
                });
            }
        });

        // Handle driver going offline (logout/disconnect)
        socketRef.current.on('driver-offline', (data: { driverId: string }) => {
            console.log('🔴 Driver went offline:', data.driverId);
            setDrivers(prev => {
                const updated = { ...prev };
                delete updated[data.driverId];
                delete updated[String(data.driverId)];
                return updated;
            });
        });

        socketRef.current.on('driver-location', handleLocationUpdate);
        socketRef.current.on('location-update', handleLocationUpdate);
        socketRef.current.on('updateLocation', handleLocationUpdate);

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    // Helper to create driver icon
    const createDriverIcon = (isOnline: boolean) => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            return L.divIcon({
                html: `
                    <div style="
                        width: 36px; 
                        height: 36px; 
                        background: ${isOnline ? '#4CAF50' : '#9E9E9E'};
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5"></path>
                            <path d="M12 19l-7-7 7-7"></path>
                        </svg>
                    </div>
                `,
                className: 'fleet-marker',
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });
        }
        return undefined;
    };

    // Filter drivers based on allowed IDs
    const filteredDrivers = Object.values(drivers).filter(driver => {
        // Only show if we have successfully fetched the list of active/allowed IDs
        if (!allowedDriverIds) return false;
        return allowedDriverIds.has(String(driver.driverId));
    });

    console.log('🗺️ Active drivers on map:', filteredDrivers.length);

    console.log('🗺️ Current drivers in state:', Object.keys(drivers));
    console.log('🗺️ Filtered drivers for display:', filteredDrivers.map(d => `${d.driverId} (${d.name || 'no name'})`));

    // New Assiut city bounds - prevent zooming out past this area
    const MAP_BOUNDS: [[number, number], [number, number]] = [
        [27.223, 31.256], // Southwest corner
        [27.315, 31.359]  // Northeast corner
    ];

    return (
        <div className="h-full w-full relative bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
            <MapContainer
                center={[MAP_CENTER.lat, MAP_CENTER.lng]}
                zoom={13}
                minZoom={12}
                maxBounds={MAP_BOUNDS}
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />

                {filteredDrivers.map((driver) => {
                    // Check if update is recent (within 5 minutes)
                    const isOnline = (Date.now() - driver.timestamp) < 5 * 60 * 1000;

                    return (
                        <Marker
                            key={driver.driverId}
                            position={[driver.lat, driver.lng]}
                            icon={createDriverIcon(isOnline)}
                        >
                            <Popup>
                                <div className="p-1 text-center">
                                    <p className="font-bold text-slate-800">{driver.name || driver.driverId}</p>
                                    <p className="text-xs text-slate-500">
                                        {isOnline ? 'نشط الآن' : 'غير نشط مؤخراً'}
                                    </p>
                                    {driver.speed !== undefined && (
                                        <p className="text-xs text-blue-600">
                                            {Math.round(driver.speed * 3.6)} كم/س
                                        </p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Status Badge */}
            <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm z-[1000] flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isConnected ? 'متصل بالشبكة' : 'منقطع'}
                </span>
                <span className="text-xs text-slate-400 border-r pr-2 border-slate-300 dark:border-slate-600">
                    {filteredDrivers.length} مندوب
                </span>
            </div>
        </div>
    );
}
