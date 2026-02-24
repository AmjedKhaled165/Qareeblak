"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Location {
    lat: number;
    lng: number;
}

interface CourierTrackingContextType {
    isTracking: boolean;
    currentLocation: Location | null;
    isExpired: boolean;
    userRole: string | null;
    startTracking: (force?: boolean) => Promise<boolean>;
    stopTracking: () => void;
}

const CourierTrackingContext = createContext<CourierTrackingContextType | null>(null);

export function CourierTrackingProvider({ children }: { children: React.ReactNode }) {
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
    const [isExpired, setIsExpired] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const userRef = useRef<any>(null);

    // Initialize User & Socket
    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserRole(user.role);
            if (user.role === 'courier') {
                userRef.current = user;

                // Initialize Socket
                const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';
                socketRef.current = io(SOCKET_URL, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: 10
                });

                socketRef.current.on('connect', () => {
                    console.log('📡 Courier Tracking Socket Connected');
                    socketRef.current?.emit('driver-online', user.id);
                });

                // Auto-start tracking if already active and not expired
                checkAndResumeTracking();
            }
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            socketRef.current?.disconnect();
        };
    }, []);

    const checkAndResumeTracking = () => {
        const expiry = localStorage.getItem('location_activation_expiry');
        if (expiry) {
            const expiryTime = parseInt(expiry);
            if (Date.now() < expiryTime) {
                // Not expired, resume tracking silently
                startTracking(true);
            } else {
                setIsExpired(true);
                setIsTracking(false);
            }
        }
    };

    // Periodically check for expiry (every minute)
    useEffect(() => {
        const interval = setInterval(() => {
            const expiry = localStorage.getItem('location_activation_expiry');
            if (expiry) {
                const expiryTime = parseInt(expiry);
                if (Date.now() >= expiryTime) {
                    setIsExpired(true);
                    if (isTracking) {
                        stopTracking();
                    }
                }
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [isTracking]);

    const startTracking = async (silent = false): Promise<boolean> => {
        if (!('geolocation' in navigator)) return false;

        return new Promise((resolve) => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const accuracy = position.coords.accuracy; // in meters

                    console.log(`📍 GPS: (${lat.toFixed(6)}, ${lng.toFixed(6)}) - دقة: ${accuracy?.toFixed(0)} متر`);

                    // تجاهل القراءات غير الدقيقة (أكثر من 520 متر)
                    if (accuracy && accuracy > 520) {
                        console.log('⚠️ تم تجاهل الموقع - الدقة ضعيفة، في انتظار إشارة أفضل...');
                        return; // انتظر قراءة أدق
                    }

                    setCurrentLocation({ lat, lng });
                    setIsTracking(true);
                    setIsExpired(false);

                    // Send to socket
                    if (socketRef.current?.connected && userRef.current) {
                        const locationData = {
                            driverId: userRef.current.id,
                            courierId: userRef.current.id,
                            name: userRef.current.name_ar || userRef.current.username,
                            lat,
                            lng,
                            latitude: lat,
                            longitude: lng,
                            speed: position.coords.speed,
                            heading: position.coords.heading,
                            accuracy: accuracy,
                            timestamp: Date.now()
                        };
                        socketRef.current.emit('driver-location', locationData);
                        socketRef.current.emit('sendLocation', locationData);
                    }

                    // On first success, set expiry if not already set or if expired
                    const currentExpiry = localStorage.getItem('location_activation_expiry');
                    if (!currentExpiry || Date.now() >= parseInt(currentExpiry)) {
                        const newExpiry = Date.now() + (24 * 60 * 60 * 1000);
                        localStorage.setItem('location_activation_expiry', newExpiry.toString());
                    }

                    resolve(true);
                },
                (error) => {
                    console.error('Tracking Error:', error);
                    setIsTracking(false);
                    resolve(false);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,        // Always get fresh position, no caching
                    timeout: 15000        // Wait up to 15 seconds for accurate GPS
                }
            );
        });
    };

    const stopTracking = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
        if (socketRef.current && userRef.current) {
            socketRef.current.emit('driver-offline', userRef.current.id);
        }
    };

    return (
        <CourierTrackingContext.Provider value={{ isTracking, currentLocation, isExpired, userRole, startTracking, stopTracking }}>
            {children}
        </CourierTrackingContext.Provider>
    );
}

export const useCourierTracking = () => {
    const context = useContext(CourierTrackingContext);
    if (!context) {
        throw new Error('useCourierTracking must be used within a CourierTrackingProvider');
    }
    return context;
};
