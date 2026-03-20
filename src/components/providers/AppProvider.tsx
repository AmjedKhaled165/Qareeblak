"use client";

import { createContext, useState, useEffect, ReactNode, useCallback, useContext, useRef } from "react";
import { providersApi, authApi, servicesApi, bookingsApi, apiCall } from "@/lib/api";
import { io } from "socket.io-client";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useToast } from "./ToastProvider";
import { usePathname, useRouter } from "next/navigation";

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
    registerUser: (name: string, email: string, password: string, phone: string) => Promise<boolean>;
    submitProviderRequest: (data: any) => Promise<boolean>;
    googleLogin: () => Promise<{ success: boolean; phoneRequired: boolean }>;

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
    const router = useRouter();
    const pathname = usePathname();
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

    // Block customer navigation until a phone number is saved.
    useEffect(() => {
        if (!isInitialized || !currentUser) return;

        const qareeblakToken = localStorage.getItem('qareeblak_token');
        if (!qareeblakToken) return;

        const userType = currentUser.user_type || currentUser.type;
        const hasPhone = Boolean(String(currentUser.phone || '').trim());
        const needsPhone = userType === 'customer' && !hasPhone;

        const currentPath = pathname || '/';
        const isAllowedPath = currentPath === '/complete-phone' || currentPath.startsWith('/login');

        if (needsPhone && !isAllowedPath) {
            localStorage.setItem('qareeblak_phone_required', '1');
            localStorage.setItem('qareeblak_post_phone_redirect', currentPath);
            router.replace('/complete-phone');
            return;
        }

        if (!needsPhone) {
            localStorage.removeItem('qareeblak_phone_required');
        }
    }, [isInitialized, currentUser, pathname, router]);

    // ================= LOAD DATA =================
    const loadProviders = useCallback(async () => {
        try {
            const data = await providersApi.getAll();
            const normalized = (Array.isArray(data) ? data : []).map((provider: any) => ({
                ...provider,
                name: typeof provider?.name === 'string' ? provider.name : 'مقدم خدمة',
                category: typeof provider?.category === 'string' ? provider.category : 'عام',
                location: typeof provider?.location === 'string' ? provider.location : '',
                services: Array.isArray(provider?.services) ? provider.services : []
            }));
            setProviders(normalized);
        } catch (error) {
            console.warn("Failed to load providers:", error);
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
            console.log('[AppProvider] Loading current user...');
            
            // 1. Qareeblak Token (real JWT)
            const qareeblakToken = localStorage.getItem('qareeblak_token');
            if (qareeblakToken) {
                console.log('[AppProvider] Found qareeblak_token');
                if (qareeblakToken === 'mock_google_token') {
                    // Google user with offline mock — restore from localStorage
                    const savedUser = localStorage.getItem('qareeblak_user');
                    if (savedUser) {
                        const parsed = JSON.parse(savedUser);
                        console.log('[AppProvider] Loaded mock user:', parsed.name);
                        setCurrentUser(parsed);
                        localStorage.setItem('user', JSON.stringify(parsed));
                        return parsed;
                    }
                    return null;
                }

                try {
                    const user = await authApi.getCurrentUser();
                    console.log('[AppProvider] Loaded qareeblak user:', user.name);
                    setCurrentUser(user);
                    localStorage.setItem('user', JSON.stringify(user));
                    return user;
                } catch (authErr: any) {
                    // Stale/invalid persisted token: clear it once to avoid 401 loops.
                    console.warn('[AppProvider] Clearing stale qareeblak session token after /auth/me failure');
                    localStorage.removeItem('qareeblak_token');
                    localStorage.removeItem('qareeblak_user');
                    localStorage.removeItem('user');
                    setCurrentUser(null);
                    return null;
                }
            }

            // 2. Halan Token (partner/courier)
            const halanToken = localStorage.getItem('halan_token');
            const halanUserStr = localStorage.getItem('halan_user');

            console.log('[AppProvider] Checking Halan token:', { hasToken: !!halanToken, hasUser: !!halanUserStr });

            if (halanToken && halanUserStr) {
                try {
                    const halanUser = JSON.parse(halanUserStr);
                    console.log('[AppProvider] Loaded Halan user:', { id: halanUser.id, name: halanUser.name, role: halanUser.role });
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

            console.log('[AppProvider] No active session found');
            return null;
        } catch (error: any) {
            console.error("[AppProvider] Failed to load user:", error);
            // Keep session persistent. Do not clear tokens automatically.
            return null;
        }
    }, []);

    // ================= INITIALIZE =================
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;
        let socket: any;

        const initialize = async () => {
            setIsLoading(true);

            // Real-time booking updates — keep this above any early returns
            // to avoid temporal dead zone access before initialization.
            const refreshBookings = () => {
                const u = currentUserRef.current;
                if (u?.id) loadUserBookings(u);
            };

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

            // Pick socket auth token based on the resolved session type.
            const isHalanSession = !!(user && (user.type === 'provider') && localStorage.getItem('halan_token'));
            const token = isHalanSession
                ? localStorage.getItem('halan_token')
                : localStorage.getItem('qareeblak_token');

            if (!token) {
                // No authenticated session yet; skip socket bootstrap and rely on HTTP flows.
                pollInterval = setInterval(refreshBookings, 120000);
                return;
            }

            socket = io(socketUrl, {
                transports: ['polling', 'websocket'],
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

    const registerUser = async (name: string, email: string, password: string, phone: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.register({ name, email, password, phone });
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

    const googleLogin = async (): Promise<{ success: boolean; phoneRequired: boolean }> => {
        setIsLoading(true);
        try {
            if (!isFirebaseConfigured()) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn("⚠️ Firebase is not configured. Falling back to Mock Google Login for local development.");
                    const mockEmail = `mock_${Math.random().toString(36).substring(7)}@google.com`;
                    const syncResult = await apiCall('/auth/google-sync', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: 'مستخدم افتراضي (تطوير)',
                            email: mockEmail,
                            googleUid: `mock_uid_${Date.now()}`,
                            avatar: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
                            firebaseIdToken: 'MOCK_TOKEN',
                            isDevMock: true,
                        })
                    });

                    if (syncResult?.user && syncResult?.token) {
                        localStorage.setItem('qareeblak_token', syncResult.token);
                        localStorage.removeItem('halan_token');
                        setCurrentUser(syncResult.user);
                        currentUserRef.current = syncResult.user;
                        localStorage.setItem('user', JSON.stringify(syncResult.user));

                        const phoneRequired = Boolean(syncResult.phoneRequired || !syncResult.user?.phone);
                        if (phoneRequired) {
                            localStorage.setItem('qareeblak_phone_required', '1');
                        } else {
                            localStorage.removeItem('qareeblak_phone_required');
                        }

                        // Reconnect socket with new token
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                        const socketUrl = apiUrl.replace(/\/api$/, '');
                        const prevSocket = (window as any).__qareeblak_socket;
                        if (prevSocket) prevSocket.disconnect();
                        const newSocket = io(socketUrl, {
                            auth: { token: syncResult.token },
                            reconnectionAttempts: 3,
                        });
                        (window as any).__qareeblak_socket = newSocket;

                        toast("تم الدخول بنجاح (وضع المطورين)", "success");
                        return { success: true, phoneRequired };
                    } else {
                        toast(syncResult?.error || "حدث خطأ في محاكاة الدخول", "error");
                        return { success: false, phoneRequired: false };
                    }
                } else {
                    toast("تسجيل الدخول عبر Google غير متاح حالياً. الرجاء الإنتظار أو استخدام البريد الإلكتروني.", "error");
                    return { success: false, phoneRequired: false };
                }
            }

            const result = await signInWithPopup(auth, googleProvider);
            const firebaseUser = result.user;

            // Get the Firebase ID token to prove identity to our backend (SECURITY CRITICAL)
            const firebaseIdToken = await firebaseUser.getIdToken();

            // Sync with backend — sends the token for server-side verification
            const syncResult = await apiCall('/auth/google-sync', {
                method: 'POST',
                body: JSON.stringify({
                    name: firebaseUser.displayName || 'مستخدم جوجل',
                    email: firebaseUser.email,
                    googleUid: firebaseUser.uid,
                    avatar: firebaseUser.photoURL,
                    firebaseIdToken, // ✅ REQUIRED: proves identity to backend
                })
            });

            if (syncResult?.user && syncResult?.token) {
                localStorage.setItem('qareeblak_token', syncResult.token);
                localStorage.removeItem('halan_token');
                setCurrentUser(syncResult.user);
                currentUserRef.current = syncResult.user;
                localStorage.setItem('user', JSON.stringify(syncResult.user));

                const phoneRequired = Boolean(syncResult.phoneRequired || !syncResult.user?.phone);
                if (phoneRequired) {
                    localStorage.setItem('qareeblak_phone_required', '1');
                } else {
                    localStorage.removeItem('qareeblak_phone_required');
                }

                // Reconnect socket with new token
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                const socketUrl = apiUrl.replace(/\/api$/, '');
                const prevSocket = (window as any).__qareeblak_socket;
                if (prevSocket) prevSocket.disconnect();
                const newSocket = io(socketUrl, {
                    auth: { token: syncResult.token },
                    reconnectionAttempts: 3,
                });
                (window as any).__qareeblak_socket = newSocket;
                newSocket.on('connect', () => {
                    newSocket.emit('user-join', { userId: syncResult.user.id, userType: syncResult.user.type });
                });
                await loadUserBookings(syncResult.user);
                return { success: true, phoneRequired };
            }

            throw new Error('فشل ربط الحساب مع الخادم');

        } catch (error: any) {
            console.error("[AppProvider] Google Sign-In Error:", error);
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                // User-initiated — not an error
            } else if (error.code === 'auth/unauthorized-domain') {
                toast('الدومين غير مسموح به في Firebase. أضف الدومين من Firebase Console.', 'error');
            } else {
                toast(error.message || 'فشل تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.', 'error');
            }
            return { success: false, phoneRequired: false };
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
                const parsedProviderId = Number(providerId);
                await servicesApi.add({
                    providerId: Number.isFinite(parsedProviderId) ? parsedProviderId : undefined,
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    image: data.image,
                    offer: data.offer
                });
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
