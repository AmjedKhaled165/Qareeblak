"use client";

import { createContext, useState, useEffect, ReactNode, useCallback, useContext } from "react";
import { providersApi, authApi, servicesApi, bookingsApi } from "@/lib/api";
import { io } from "socket.io-client";

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
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
    date?: string;
    details?: string;
    items?: any[];
    halanOrderId?: number;
    updatedAt?: string;
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
    createBooking: (booking: Omit<Booking, 'id' | 'status'>) => Promise<boolean>;
    updateBookingStatus: (id: string, status: Booking['status']) => Promise<boolean>;

    // Review actions
    addReview: (providerId: string, rating: number, comment: string) => Promise<boolean>;

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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
        const token = localStorage.getItem('qareeblak_token');
        if (!token) return;

        // HANDLE MOCK GOOGLE LOGIN
        if (token === 'mock_google_token') {
            const savedUser = localStorage.getItem('qareeblak_user');
            if (savedUser) {
                setCurrentUser(JSON.parse(savedUser));
            }
            return;
        }

        try {
            const user = await authApi.getCurrentUser();
            setCurrentUser(user);
        } catch (error) {
            console.error("Failed to load user:", error);
            localStorage.removeItem('qareeblak_token');
        }
    }, []);

    // ================= INITIALIZE =================
    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            await Promise.all([
                loadProviders(),
                loadBookings(),
                loadCurrentUser()
            ]);
            setIsInitialized(true);
            setIsLoading(false);
        };
        initialize();

        // Real-time socket updates
        const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');

        socket.on('booking-updated', (data) => {
            console.log('Real-time booking update:', data);
            loadBookings();
        });

        socket.on('order-status-changed', (data) => {
            console.log('Real-time delivery status update:', data);
            loadBookings();
        });

        // Listen for item changes/general updates from Halan side
        socket.on('order-updated', (data) => {
            console.log('Real-time Halan order update:', data);
            loadBookings();
        });

        // Polling for updates (every 30 seconds)
        // This ensures the provider sees cancellations even without a manual refresh
        const pollInterval = setInterval(() => {
            if (localStorage.getItem('qareeblak_token')) {
                loadBookings();
            }
        }, 30000);

        return () => {
            clearInterval(pollInterval);
            socket.disconnect();
        };
    }, [loadProviders, loadBookings, loadCurrentUser]);

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
            await new Promise(resolve => setTimeout(resolve, 1500));

            const mockUser: User = {
                id: 999,
                name: "مستخدم جوجل",
                email: "google@example.com",
                type: "customer"
            };

            setCurrentUser(mockUser);
            // Set mock token to persist session
            localStorage.setItem('qareeblak_token', 'mock_google_token');
            // Save user data primarily for rehydration if offline
            localStorage.setItem('qareeblak_user', JSON.stringify(mockUser));

            console.log("Simulated Google Login Success");
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
    const createBooking = async (booking: Omit<Booking, 'id' | 'status'>): Promise<boolean> => {
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
                items: booking.items
            });
            await loadBookings();
            return result; // return the result which should contain the new ID
        } catch (error) {
            console.error("Booking failed:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateBookingStatus = async (id: string, status: Booking['status']): Promise<boolean> => {
        try {
            setIsLoading(true);
            await bookingsApi.updateStatus(id, status);
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
        addReview
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ================= HOOK =================
export function useAppStore(): AppContextType {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppStore must be used within AppProvider");
    }
    return context;
}

export default AppContext;
