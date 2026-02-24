"use client";

import { createContext, useState, useEffect, ReactNode, useCallback, useContext } from "react";
import { providersApi, authApi, servicesApi, bookingsApi, apiCall } from "@/lib/api";
import { io } from "socket.io-client";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";


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
    type?: "customer" | "provider";
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

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    providerId: string;
    providerName: string;
    image?: string;
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

    // User actions
    // Optimistic UI Actions
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
    // Cart Actions for Order Updates
    addToInfoCart: (orderId: string, item: any) => void;
    removeFromInfoCart: (orderId: string, itemIndex: number) => void;
    clearInfoCart: (orderId: string) => void;
    submitInfoCart: (orderId: string, providerId?: string) => Promise<boolean>;
    pendingCartItems: Record<string, any[]>;

    // Global Cart Actions
    globalCart: CartItem[];
    addToGlobalCart: (item: CartItem) => void;
    removeFromGlobalCart: (providerId: string, itemId: string) => void;
    updateGlobalCartQuantity: (providerId: string, itemId: string, quantity: number) => void;
    clearGlobalCart: () => void;
    checkoutGlobalCart: (addressInfo?: { area: string, details: string, phone: string }, userPrizeId?: number) => Promise<string[] | false>;
}

const AppContext = createContext<AppContextType | null>(null);

// ================= PROVIDER COMPONENT =================
export function AppProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingCartItems, setPendingCartItems] = useState<Record<string, any[]>>({});
    const [globalCart, setGlobalCart] = useState<CartItem[]>([]);

    // Load global cart from localStorage on init
    useEffect(() => {
        const savedCart = localStorage.getItem('qareeblak_cart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                if (Array.isArray(parsed)) {
                    // Clean up and ensure all items have necessary fields
                    const validItems = parsed.filter(i => i.id && i.providerId).map(i => ({
                        ...i,
                        id: String(i.id),
                        providerId: String(i.providerId)
                    }));
                    setGlobalCart(validItems);
                }
            } catch (e) {
                console.error("Failed to parse saved cart");
            }
        }
    }, []);

    // Save global cart to localStorage on change
    useEffect(() => {
        localStorage.setItem('qareeblak_cart', JSON.stringify(globalCart));
    }, [globalCart]);

    // ================= LOAD DATA =================
    const loadProviders = useCallback(async () => {
        try {
            const data = await providersApi.getAll();
            setProviders(data);
        } catch (error) {
            console.error("Failed to load providers:", error);
            // Fallback to empty array
            setProviders([]);
        }
    }, []);

    const loadBookings = useCallback(async () => {
        try {
            const data = await bookingsApi.getAll();
            setBookings(data);
        } catch (error) {
            console.error("Failed to load bookings:", error);
            setBookings([]);
        }
    }, []);

    const loadCurrentUser = useCallback(async () => {
        try {
            console.log('[AppProvider] 📝 Loading current user...');

            // 1. Check for Qareeblak Token
            const qareeblakToken = localStorage.getItem('qareeblak_token');
            if (qareeblakToken) {
                if (qareeblakToken === 'mock_google_token') {
                    const savedUser = localStorage.getItem('qareeblak_user');
                    if (savedUser) {
                        setCurrentUser(JSON.parse(savedUser));
                        console.log('[AppProvider] ✅ Mock user loaded');
                    }
                    return;
                }

                console.log('[AppProvider] 🌐 Fetching Qareeblak user profile...');
                const user = await authApi.getCurrentUser();
                setCurrentUser(user);
                console.log('[AppProvider] ✅ User loaded successfully:', user.name);
                return;
            }

            // 2. Check for Halan Token if no Qareeblak Token
            const halanToken = localStorage.getItem('halan_token');
            const halanUserStr = localStorage.getItem('halan_user');

            if (halanToken && halanUserStr) {
                console.log('[AppProvider] 💼 Hydrating Halan user from local storage...');
                try {
                    const halanUser = JSON.parse(halanUserStr);
                    // Adapt Halan user to User interface
                    const adaptedUser: User = {
                        id: halanUser.id,
                        name: halanUser.name,
                        email: halanUser.email,
                        type: 'provider', // Explicitly set as provider
                        phone: halanUser.phone
                    };
                    setCurrentUser(adaptedUser);
                    console.log('[AppProvider] ✅ Halan user hydrated:', adaptedUser.name);
                } catch (e) {
                    console.error('[AppProvider] ❌ Failed to parse halan_user', e);
                    // Don't clear token here, might be valid just bad user data
                }
                return;
            }

            console.log('[AppProvider] ℹ️ No valid session found.');

        } catch (error: any) {
            console.error("[AppProvider] ❌ Failed to load user:", error);

            // CRITICAL FIX: Only clear token if it's explicitly an auth error (401/403)
            // Do NOT clear on 500, 404, or network errors
            const errorMessage = error.message || "";
            const isAuthError = errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("غير مصرح") ||
                errorMessage.includes("عدم التفويض") ||
                errorMessage.includes("session expired");

            if (isAuthError) {
                console.log("[AppProvider] 🔐 Auth error detected, clearing qareeblak session");
                localStorage.removeItem('qareeblak_token');
                // Do NOT clear halan_token here, as we didn't verify it.
                // Keep provider session alive even if user session is expired.
                setCurrentUser(null);
            } else {
                console.warn("[AppProvider] ⚠️ Non-auth error during user load. Keeping token for retry.");
            }
            // Otherwise, keep the token! The server might just be down momentarily.
        }
    }, []);

    // ================= INITIALIZE =================
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;
        let socket: any;

        const initialize = async () => {
            console.log('[AppProvider] 🚀 Starting initialization...');
            console.log('[AppProvider] 🔑 Checking for existing tokens...');

            // CRITICAL: Check for tokens BEFORE setting any state
            const qareeblakToken = localStorage.getItem('qareeblak_token');
            const halanToken = localStorage.getItem('halan_token');

            console.log('[AppProvider] Token status:', {
                qareeblak: qareeblakToken ? '✓ Present' : '✗ Missing',
                halan: halanToken ? '✓ Present' : '✗ Missing'
            });

            setIsLoading(true);

            // Load data in parallel
            // Only load bookings if user has a token (bookings endpoint now requires auth)
            const hasToken = !!qareeblakToken || !!halanToken;
            await Promise.all([
                loadProviders(),
                hasToken ? loadBookings() : Promise.resolve(),
                loadCurrentUser()
            ]);

            console.log('[AppProvider] ✅ Initialization complete');

            setIsInitialized(true);
            setIsLoading(false);

            // Real-time socket updates
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const socketUrl = apiUrl.replace(/\/api$/, '');
            socket = io(socketUrl);

            socket.on('booking-updated', (data: any) => {
                console.log('Real-time booking update:', data);
                loadBookings();
            });

            socket.on('order-status-changed', (data: any) => {
                console.log('Real-time delivery status update:', data);
                loadBookings();
            });

            // Listen for item changes/general updates from Halan side
            socket.on('order-updated', (data: any) => {
                console.log('Real-time Halan order update:', data);
                loadBookings();
            });

            // Store socket wrapper for other effects
            (window as any).__qareeblak_socket = socket;

            // Polling for updates (fallback, reduced frequency to 2 mins)
            pollInterval = setInterval(() => {
                if (localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token')) {
                    loadBookings();
                }
            }, 120000);
        };

        initialize();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            if (socket) socket.disconnect();
            (window as any).__qareeblak_socket = null;
        };
    }, [loadProviders, loadBookings, loadCurrentUser]);

    // ================= CONNECT USER TO PRIVATE SOCKET ROOM =================
    useEffect(() => {
        const socket = (window as any).__qareeblak_socket;
        if (socket && currentUser?.id) {
            socket.emit('user-join', { userId: currentUser.id, userType: currentUser.type });
            console.log(`[AppProvider] Linked socket to user room: user-${currentUser.id}`);
        }
    }, [currentUser]);

    // ================= AUTH ACTIONS =================
    const loginUser = async (email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.login(email, password);
            setCurrentUser(result.user);
            await loadProviders(); // Refresh providers after login
            return true;
        } catch (error) {
            console.error("Login failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        authApi.logout();
        // Clear mock data if any
        localStorage.removeItem('qareeblak_user');
        if (localStorage.getItem('qareeblak_token') === 'mock_google_token') {
            localStorage.removeItem('qareeblak_token');
        }
        setCurrentUser(null);
    };

    const registerUser = async (name: string, email: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const result = await authApi.register(name, email, password);
            setCurrentUser(result.user);
            return true;
        } catch (error) {
            console.error("Registration failed:", error);
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
            // Auto-login after provider request (since it auto-approves)
            await authApi.login(data.email, data.password);
            const user = await authApi.getCurrentUser();
            setCurrentUser(user);
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
            // 🚀 This opens the "Real Sites" popup for Gmail selection
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            console.log("[AppProvider] Google Sign-In Success:", user.displayName);

            const adaptedUser: User = {
                id: 999, // Backend should ideally handle sync
                name: user.displayName || "مستخدم جوجل",
                email: user.email || "",
                type: 'customer',
                avatar: user.photoURL || undefined
            };

            setCurrentUser(adaptedUser);

            // Persist locally for the session
            localStorage.setItem('qareeblak_token', 'firebase_active_session'); // Placeholder token
            localStorage.setItem('qareeblak_user', JSON.stringify(adaptedUser));

            // Optional: You can send 'user.accessToken' to your backend here to create a real user record
            // await apiCall('/auth/google-sync', { method: 'POST', body: JSON.stringify({ token: user.accessToken }) });

        } catch (error: any) {
            console.error("[AppProvider] Google Sign-In Error:", error);
            // Handle common Firebase errors
            if (error.code === 'auth/popup-closed-by-user') {
                console.warn("User closed the login popup");
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.warn("Popup request cancelled");
            } else {
                throw error;
            }
        } finally {
            setIsLoading(false);
        }
    };


    // ================= CART ACTIONS (FOR ORDER UPDATES) =================
    const addToInfoCart = (orderId: string, item: any) => {
        setPendingCartItems(prev => {
            const currentItems = prev[orderId] || [];
            return {
                ...prev,
                [orderId]: [...currentItems, item]
            };
        });
    };

    const removeFromInfoCart = (orderId: string, itemIndex: number) => {
        setPendingCartItems(prev => {
            const currentItems = prev[orderId] || [];
            const newItems = [...currentItems];
            newItems.splice(itemIndex, 1);
            return {
                ...prev,
                [orderId]: newItems
            };
        });
    };

    const clearInfoCart = (orderId: string) => {
        setPendingCartItems(prev => {
            const { [orderId]: removed, ...rest } = prev;
            return rest;
        });
    };

    const submitInfoCart = async (orderId: string, providerId?: string): Promise<boolean> => {
        const items = pendingCartItems[orderId];
        if (!items || items.length === 0) return false;

        setIsLoading(true);
        try {
            console.log(`[AppStore] Submitting bulk items for Order #${orderId}:`, items);

            // Use apiCall which correctly handles the BASE_URL and /api prefix
            const response = await apiCall(`/halan/orders/${orderId}/customer-add-items-bulk`, {
                method: 'POST',
                body: JSON.stringify({ items, providerId })
            });

            if (!response.success && !response.items) {
                throw new Error(response.error || "Failed to add items in bulk");
            }

            console.log(`[AppStore] Bulk addition successful for #${orderId}`);
            clearInfoCart(orderId);
            await loadBookings(); // Refresh bookings to see changes
            return true;
        } catch (error) {
            console.error("Failed to submit cart items:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // ================= GLOBAL CART ACTIONS =================
    const addToGlobalCart = (item: CartItem) => {
        console.log(`[AppStore] Adding to global cart:`, item);
        const normalizedItem = {
            ...item,
            id: String(item.id),
            providerId: String(item.providerId)
        };
        setGlobalCart(prev => {
            const existing = prev.find(i => String(i.id) === normalizedItem.id && String(i.providerId) === normalizedItem.providerId);
            if (existing) {
                return prev.map(i =>
                    (String(i.id) === normalizedItem.id && String(i.providerId) === normalizedItem.providerId)
                        ? { ...i, quantity: i.quantity + normalizedItem.quantity }
                        : i
                );
            }
            return [...prev, normalizedItem];
        });
    };

    const removeFromGlobalCart = (providerId: string, itemId: string) => {
        console.log(`[AppStore] Removing from global cart: providerId=${providerId}, itemId=${itemId}`);
        setGlobalCart(prev => prev.filter(i => !(String(i.id) === String(itemId) && String(i.providerId) === String(providerId))));
    };

    const updateGlobalCartQuantity = (providerId: string, itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromGlobalCart(providerId, itemId);
            return;
        }
        setGlobalCart(prev => prev.map(i =>
            (i.id === itemId && i.providerId === providerId)
                ? { ...i, quantity }
                : i
        ));
    };

    const clearGlobalCart = () => {
        setGlobalCart([]);
    };

    const checkoutGlobalCart = async (addressInfo?: { area: string, details: string, phone: string }, userPrizeId?: number): Promise<string[] | false> => {
        if (!currentUser) return false;
        if (globalCart.length === 0) return false;

        setIsLoading(true);
        try {
            console.log(`[AppStore] Checkout initiated for user ${currentUser.id} with items:`, globalCart);

            const result = await bookingsApi.checkout({
                userId: currentUser.id === 999 ? '999' : currentUser.id || '', // Handle mock user
                items: globalCart,
                addressInfo: addressInfo,
                userPrizeId: userPrizeId
            });

            if (result && result.success) {
                console.log(`[AppStore] Checkout success. ParentID: ${result.parentId}, BookingIDs: ${result.bookingIds}`);
                clearGlobalCart();
                await loadBookings(); // Refresh bookings immediately
                return result.parentId ? [`P${result.parentId}`] : (result.bookingIds || []);
            } else {
                console.error(`[AppStore] Checkout failed:`, result);
                return false;
            }
        } catch (error) {
            console.error("Checkout exception:", error);
            return false;
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
                await servicesApi.add({
                    providerId,
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    image: data.image,
                    offer: data.offer
                });
            } else if (action === 'update') {
                await servicesApi.update(data.id, {
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    image: data.image,
                    offer: data.offer
                });
            } else if (action === 'delete') {
                await servicesApi.delete(data.id);
            }

            // Refresh providers to get updated services
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
            // Handle mock user ID (999) - don't send it to backend to avoid FK violation
            const userId = (booking.userId || currentUser?.id);
            const validUserId = (userId === 999 || userId === '999') ? undefined : userId;

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
                bundleId: booking.bundleId
            });
            await loadBookings();

            // Check if result has ID directly or inside data
            if (result && result.id) {
                return String(result.id);
            }
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
            await loadBookings();
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
                comment
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

    // Optimistic Update Helper
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
        // Cart
        addToInfoCart,
        removeFromInfoCart,
        clearInfoCart,
        submitInfoCart,
        pendingCartItems,
        // Global Cart
        globalCart,
        addToGlobalCart,
        removeFromGlobalCart,
        updateGlobalCartQuantity,
        clearGlobalCart,
        checkoutGlobalCart,
        optimisticUpdate  // Add to context
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
