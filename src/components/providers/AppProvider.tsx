"use client";

import { createContext, useState, useEffect, ReactNode, useCallback, useContext, useRef } from "react";
import { providersApi, authApi, servicesApi, bookingsApi, apiCall } from "@/lib/api";
import { io } from "socket.io-client";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useToast } from "./ToastProvider";

// ================= TYPES =================
interface ProviderService {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    offer?: {
        type: "discount" | "bundle";
        discountPercent?: number;
        bundleCount?: number;
        bundleFreeCount?: number;
        endDate?: string;
    };
}

interface Review {
    id: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
}

interface Provider {
    id: string;
    userId?: string | number;
    name: string;
    email: string;
    category: string;
    rating: number;
    reviews: number;
    reviewsList: Review[];
    location: string;
    phone: string;
    isApproved: boolean;
    joinedDate: string;
    services: ProviderService[];
}

interface User {
    id?: number;
    name: string;
    email: string;
    password?: string;
    type?: "customer" | "provider" | "admin";
    user_type?: string;
    phone?: string;
    avatar?: string;
}

interface Booking {
    id: string;
    userId?: string | number;
    userName: string;
    serviceId?: string;
    serviceName: string;
    price?: number;
    providerId: string;
    providerName: string;
    status: 'pending' | 'pending_appointment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'provider_rescheduled' | 'customer_rescheduled';
    date?: string;
    details?: string;
    items?: any[];
    halanOrderId?: number;
    updatedAt?: string;
    bundleId?: string;
    appointmentDate?: string;
    appointmentType?: string;
    lastUpdatedBy?: 'provider' | 'customer';
}

interface AppContextType {
    currentUser: User | null;
    providers: Provider[];
    bookings: Booking[];
    isInitialized: boolean;
    isLoading: boolean;

    // Auth actions
    loginUser: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    registerUser: (name: string, email: string, password: string) => Promise<boolean>;
    submitProviderRequest: (data: any) => Promise<boolean>;
    googleLogin: () => Promise<void>;

    // Provider actions
    refreshProviders: () => Promise<void>;
    deleteProvider: (id: string) => Promise<boolean>;

    // Service actions
    manageService: (providerId: string, action: 'add' | 'update' | 'delete', data: any) => Promise<boolean>;

    // Booking actions
    createBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<string | false>;
    updateBookingStatus: (id: string, status: Booking['status'], price?: number) => Promise<boolean>;

    // Review actions
    addReview: (providerId: string, rating: number, comment: string) => Promise<boolean>;

    // Optimistic UI
    optimisticUpdate: (id: string, updates: Partial<Booking>) => void;

    // User actions
    updateUser: (data: {
        name?: string;
        email?: string;
        phone?: string;
        avatar?: string;
        oldPassword?: string;
        newPassword?: string;
    }) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | null>(null);

// ================= PROVIDER COMPONENT =================
export function AppProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // useRef to track current user in closures (intervals, socket callbacks)
    // without causing re-renders or stale closures
    const currentUserRef = useRef<User | null>(null);

    // Keep ref in sync with state (no dependency on currentUser for interval closures)
    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

    // ================= LOAD DATA =================
    const loadProviders = useCallback(async () => {
        try {
            const data = await providersApi.getAll();
            setProviders(data);
        } catch (error) {
            console.error("Failed to load providers:", error);
            setProviders([]);
        }
    }, []);

    /**
     * Load bookings for a specific user (smart routing by user type).
     * - Admin: fetches all bookings via GET /bookings
     * - Customer: fetches only their bookings via GET /bookings/user/:id
     * - Provider: skips (providers load from their own dashboard)
     * - Mock/unauthenticated: skips
     */
    const loadUserBookings = useCallback(async (user: User | null) => {
        try {
            if (!user?.id || user.id === 999) {
                // Skip mock Google users (id=999) — they have no real server-side bookings
                return;
            }

            const userType = user.user_type || user.type;

            if (userType === 'admin') {
                // Admin: get all recent bookings (paginated, newest first)
                const result = await apiCall('/bookings?limit=50');
                setBookings(result?.bookings || []);
            } else if (userType === 'customer' || !userType) {
                // Customer: only their own bookings
                const result = await bookingsApi.getByUser(String(user.id));
                setBookings(result?.bookings || []);
            }
            // Providers: skip — their bookings are loaded per-page in the dashboard

        } catch (error) {
            console.error("Failed to load user bookings:", error);
            setBookings([]);
        }
    }, []);

    /**
     * Load and return the current user.
     * Returns the user object so callers can chain behavior.
     */
    const loadCurrentUser = useCallback(async (): Promise<User | null> => {
        try {
            // 1. Qareeblak Token (real JWT)
            const qareeblakToken = localStorage.getItem('qareeblak_token');
            if (qareeblakToken) {
                if (qareeblakToken === 'mock_google_token') {
                    // Google user with offline mock — restore from localStorage
                    const savedUser = localStorage.getItem('qareeblak_user');
                    if (savedUser) {
                        const parsed = JSON.parse(savedUser);
                        setCurrentUser(parsed);
                        localStorage.setItem('user', JSON.stringify(parsed));
                        return parsed;
                    }
                    return null;
                }

                const user = await authApi.getCurrentUser();
                setCurrentUser(user);
                localStorage.setItem('user', JSON.stringify(user));
                return user;
            }

            // 2. Halan Token (partner/courier)
            const halanToken = localStorage.getItem('halan_token');
            const halanUserStr = localStorage.getItem('halan_user');

            if (halanToken && halanUserStr) {
                try {
                    const halanUser = JSON.parse(halanUserStr);
                    const adaptedUser: User = {
                        id: halanUser.id,
                        name: halanUser.name,
                        email: halanUser.email,
                        type: 'provider',
                        phone: halanUser.phone,
                    };
                    setCurrentUser(adaptedUser);
                    return adaptedUser;
                } catch (e) {
                    console.error('[AppProvider] Failed to parse halan_user', e);
                }
            }

            return null;
        } catch (error: any) {
            console.error("[AppProvider] Failed to load user:", error);

            // Only clear token on explicit auth errors — not on server/network errors
            const msg = error.message || "";
            const isAuthError = msg.includes("401") || msg.includes("403") ||
                msg.includes("غير مصرح") || msg.includes("عدم التفويض");

            if (isAuthError) {
                localStorage.removeItem('qareeblak_token');
                setCurrentUser(null);
            }
            return null;
        }
    }, []);

    // ================= INITIALIZE =================
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;
        let socket: any;

        const initialize = async () => {
            setIsLoading(true);

            // Load providers AND user in parallel (they're independent)
            const [, user] = await Promise.all([
                loadProviders(),
                loadCurrentUser(),
            ]);

            // Load bookings AFTER we know who the user is (sequential by design)
            await loadUserBookings(user);

            setIsInitialized(true);
            setIsLoading(false);

            // ✅ FIXED: Socket.io with Auth Token
            // Backend requires token via verifySocketToken middleware
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const socketUrl = apiUrl.replace(/\/api$/, '');
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');

            socket = io(socketUrl, {
                auth: { token: token || undefined },
                reconnectionAttempts: 3,
                reconnectionDelay: 5000,
                // Don't spam reconnects if auth fails
                reconnectionDelayMax: 15000,
            });

            socket.on('connect_error', (err: Error) => {
                if (err.message.includes('Authentication') || err.message.includes('Token')) {
                    // Auth failed — don't keep retrying (token is invalid or missing)
                    socket.disconnect();
                }
            });

            // Real-time booking updates — use ref to avoid stale closures
            const refreshBookings = () => {
                const u = currentUserRef.current;
                if (u?.id) loadUserBookings(u);
            };

            socket.on('booking-updated', refreshBookings);
            socket.on('order-status-changed', refreshBookings);
            socket.on('order-updated', refreshBookings);

            // Store globally so other effects can emit to it
            (window as any).__qareeblak_socket = socket;

            // Polling fallback (2-min interval, uses ref for fresh user data)
            pollInterval = setInterval(refreshBookings, 120000);
        };

        initialize();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            if (socket) socket.disconnect();
            (window as any).__qareeblak_socket = null;
        };
    }, [loadProviders, loadCurrentUser, loadUserBookings]); // Only run once on mount

    // Join user-specific socket room when user identity is confirmed
    useEffect(() => {
        const socket = (window as any).__qareeblak_socket;
        if (socket?.connected && currentUser?.id) {
            socket.emit('user-join', { userId: currentUser.id, userType: currentUser.type });
        }
    }, [currentUser]);

    // ================= AUTH ACTIONS =================
    const loginUser = async (email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.login(email, password);
            const user = result.user;
            setCurrentUser(user);
            currentUserRef.current = user;

            // Reconnect socket with new token
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const socketUrl = apiUrl.replace(/\/api$/, '');
            const prevSocket = (window as any).__qareeblak_socket;
            if (prevSocket) prevSocket.disconnect();
            const newSocket = io(socketUrl, {
                auth: { token: result.token },
                reconnectionAttempts: 3,
            });
            (window as any).__qareeblak_socket = newSocket;
            newSocket.on('connect', () => {
                newSocket.emit('user-join', { userId: user.id, userType: user.type || user.user_type });
            });

            await Promise.all([loadProviders(), loadUserBookings(user)]);
            return true;
        } catch (error) {
            console.error("Login failed:", error);
            toast("البريد الإلكتروني أو كلمة المرور غير صحيحة", "error");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        authApi.logout();
        localStorage.removeItem('qareeblak_user');
        localStorage.removeItem('user');
        if (localStorage.getItem('qareeblak_token') === 'mock_google_token') {
            localStorage.removeItem('qareeblak_token');
        }
        setCurrentUser(null);
        currentUserRef.current = null;
        setBookings([]);

        // Disconnect socket on logout
        const socket = (window as any).__qareeblak_socket;
        if (socket) socket.disconnect();
    };

    const registerUser = async (name: string, email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.register(name, email, password);
            const user = result.user;
            setCurrentUser(user);
            currentUserRef.current = user;
            return true;
        } catch (error) {
            console.error("Registration failed:", error);
            toast("فشل إنشاء الحساب. قد يكون البريد مستخدماً بالفعل", "error");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = async (data: {
        name?: string;
        email?: string;
        phone?: string;
        avatar?: string;
        oldPassword?: string;
        newPassword?: string;
    }): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.updateProfile(data);
            if (result.success) {
                setCurrentUser(result.user);
                currentUserRef.current = result.user;
                return true;
            }
            return false;
        } catch (error) {
            console.error("Update profile failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const submitProviderRequest = async (data: any): Promise<boolean> => {
        try {
            setIsLoading(true);
            await authApi.submitProviderRequest(data);
            await authApi.login(data.email, data.password);
            const user = await authApi.getCurrentUser();
            setCurrentUser(user);
            currentUserRef.current = user;
            await loadProviders();
            return true;
        } catch (error) {
            console.error("Provider request failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = async () => {
        setIsLoading(true);
        try {
            if (!isFirebaseConfigured()) {
                // Firebase not configured — fallback to guest JWT session
                const result = await authApi.guestLogin();
                if (result?.user) {
                    setCurrentUser(result.user);
                    currentUserRef.current = result.user;
                    localStorage.setItem('user', JSON.stringify(result.user));
                }
                return;
            }

            const result = await signInWithPopup(auth, googleProvider);
            const firebaseUser = result.user;

            // ✅ FIXED: Instead of hardcoded id=999, sync with backend to get real user ID
            // Try to register/fetch the user via their Google email
            try {
                // Attempt to auto-register via backend Google sync
                const syncResult = await apiCall('/auth/google-sync', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: firebaseUser.displayName || 'مستخدم جوجل',
                        email: firebaseUser.email,
                        googleUid: firebaseUser.uid,
                        avatar: firebaseUser.photoURL,
                    })
                });
                if (syncResult?.user && syncResult?.token) {
                    localStorage.setItem('qareeblak_token', syncResult.token);
                    localStorage.removeItem('halan_token');
                    setCurrentUser(syncResult.user);
                    currentUserRef.current = syncResult.user;
                    localStorage.setItem('user', JSON.stringify(syncResult.user));
                    return;
                }
            } catch {
                // Backend sync not available — fall back to local session until implemented
            }

            // Offline fallback (use mock session until google-sync backend endpoint is ready)
            const adaptedUser: User = {
                id: undefined, // Don't set a fake ID
                name: firebaseUser.displayName || 'مستخدم جوجل',
                email: firebaseUser.email || '',
                type: 'customer',
                avatar: firebaseUser.photoURL || undefined,
            };

            setCurrentUser(adaptedUser);
            currentUserRef.current = adaptedUser;
            localStorage.setItem('qareeblak_token', 'mock_google_token');
            localStorage.setItem('qareeblak_user', JSON.stringify(adaptedUser));
            localStorage.setItem('user', JSON.stringify(adaptedUser));

        } catch (error: any) {
            console.error("[AppProvider] Google Sign-In Error:", error);
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                // User-initiated — not an error
            } else if (error.code === 'auth/unauthorized-domain') {
                throw new Error('الدومين غير مسموح به في Firebase. أضف الدومين من Firebase Console > Authentication > Settings > Authorized domains.');
            } else {
                throw error;
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ================= PROVIDER ACTIONS =================
    const refreshProviders = async () => {
        await loadProviders();
    };

    const deleteProvider = async (id: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            await providersApi.delete(id);
            await loadProviders();
            return true;
        } catch (error) {
            console.error("Delete provider failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // ================= SERVICE ACTIONS =================
    const manageService = async (providerId: string, action: 'add' | 'update' | 'delete', data: any): Promise<boolean> => {
        try {
            setIsLoading(true);

            if (action === 'add') {
                await servicesApi.add({ providerId, name: data.name, description: data.description, price: data.price, image: data.image, offer: data.offer });
            } else if (action === 'update') {
                await servicesApi.update(data.id, { name: data.name, description: data.description, price: data.price, image: data.image, offer: data.offer });
            } else if (action === 'delete') {
                await servicesApi.delete(data.id);
            }

            await loadProviders();
            return true;
        } catch (error) {
            console.error("Service operation failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // ================= BOOKING ACTIONS =================
    const createBooking = async (booking: Omit<Booking, 'id' | 'status'>): Promise<string | false> => {
        try {
            setIsLoading(true);
            const userId = (booking.userId || currentUser?.id);
            // Never send mock/undefined userId to backend to avoid FK violations
            const validUserId = (!userId || userId === 999 || userId === '999') ? undefined : userId;

            const result = await bookingsApi.create({
                userId: validUserId,
                providerId: booking.providerId || '',
                serviceId: booking.serviceId,
                userName: booking.userName,
                serviceName: booking.serviceName,
                providerName: booking.providerName,
                price: booking.price,
                details: booking.details,
                items: booking.items,
                bundleId: booking.bundleId,
            });

            // Refresh bookings for this user
            const u = currentUserRef.current;
            if (u?.id) await loadUserBookings(u);

            if (result?.id) return String(result.id);
            return false;
        } catch (error) {
            console.error("Booking failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBookingStatus = async (id: string, status: Booking['status'], price?: number): Promise<boolean> => {
        try {
            setIsLoading(true);
            await bookingsApi.updateStatus(id, status, price);
            const u = currentUserRef.current;
            if (u?.id) await loadUserBookings(u);
            return true;
        } catch (error) {
            console.error("Booking status update failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // ================= REVIEW ACTIONS =================
    const addReview = async (providerId: string, rating: number, comment: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            await providersApi.addReview(providerId, {
                userName: currentUser?.name || 'مجهول',
                rating,
                comment,
            });
            await loadProviders();
            return true;
        } catch (error) {
            console.error("Review failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Optimistic Update Helper (immediate UI feedback before server confirms)
    const optimisticUpdate = useCallback((id: string, updates: Partial<Booking>) => {
        setBookings(prev => prev.map(booking =>
            String(booking.id) === String(id) ? { ...booking, ...updates } : booking
        ));
    }, []);

    // ================= CONTEXT VALUE =================
    const value: AppContextType = {
        currentUser,
        providers,
        bookings,
        isInitialized,
        isLoading,
        loginUser,
        logout,
        registerUser,
        updateUser,
        submitProviderRequest,
        googleLogin,
        refreshProviders,
        deleteProvider,
        manageService,
        createBooking,
        updateBookingStatus,
        addReview,
        optimisticUpdate,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ================= HOOK =================
export function useAppStore(): AppContextType {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppStore must be used within an AppProvider");
    }
    return context;
}

export default AppContext;
