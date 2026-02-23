"use client";

import { useAppStore } from "@/components/providers/AppProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { LayoutDashboard, ShoppingBag, Star, TrendingUp, Settings, LogOut, Utensils, Plus, Trash2, Edit, Check, X, Clock, Camera, Upload, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { apiCall, bookingsApi } from "@/lib/api";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { format } from "date-fns";
import { isPharmacyProvider, isMaintenanceProvider } from "@/lib/category-utils";
import { ConsultationChat } from "@/components/provider/ConsultationChat";
import { MessageSquare } from "lucide-react";
import { io } from "socket.io-client";
import { PriceEstimationModal } from "@/components/providers/MaintenanceModals";
import { OrderDetailModal } from "@/components/providers/OrderDetailModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = API_URL.replace(/\/api$/, ''); // Ensure no trailing /api

// Type definitions
interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    hasOffer?: boolean;
    offerType?: "discount" | "bundle";
    discountPercent?: number;
    bundleCount?: number;
    bundleFreeCount?: number;
    offerEndDate?: string;
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
    email?: string;
    category?: string;
    services: Service[];
    reviewsList?: Review[];
    rating?: number;
}

interface Booking {
    id: string;
    userId?: string | number;
    userName: string;
    serviceName: string;
    providerName: string;
    providerId?: string;
    status: 'pending' | 'pending_appointment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'provider_rescheduled' | 'customer_rescheduled';
    date?: string;
    details?: string;
    items?: any[];
    price?: number;
    halanOrderId?: number;
    appointmentDate?: string;
    appointmentType?: string;
    lastUpdatedBy?: 'provider' | 'customer';
}

const HalanItemsList = ({ halanOrderId, bookingId, fallback }: { halanOrderId?: number, bookingId: string, fallback: React.ReactNode }) => {
    const [items, setItems] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const idToFetch = halanOrderId || bookingId;
        const endpoint = halanOrderId ? `/halan/orders/${halanOrderId}` : `/halan/orders/track/${bookingId}`;

        const fetchItems = async () => {
            setLoading(true);
            try {
                const data = await apiCall(endpoint);
                // The track endpoint returns { success: true, order: { items: ... } }
                // The order endpoint returns { success: true, data: { items: ... } }
                const orderData = data.data || data.order;
                if (data.success && orderData && orderData.items) {
                    const parsedItems = typeof orderData.items === 'string'
                        ? JSON.parse(orderData.items)
                        : orderData.items;
                    setItems(parsedItems);
                }
            } catch (error) {
                console.error('Error fetching live items:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
        const interval = setInterval(fetchItems, 5000);
        return () => clearInterval(interval);
    }, [halanOrderId, bookingId]);

    // If we have items from live fetch, show them. Otherwise use fallback.
    if (loading && !items) return <div className="text-[10px] text-muted-foreground animate-pulse">جاري تحديث المنتجات...</div>;
    if (!items || items.length === 0) return <>{fallback}</>;

    return (
        <div className="space-y-1 mt-2">
            {items.map((item, idx) => (
                <div key={idx} className="text-xs font-black text-primary flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/30"></span>
                    <span>{item.name || item.product_name} x{item.quantity}</span>
                </div>
            ))}
        </div>
    );
};

export default function ProviderDashboard() {
    const { currentUser, bookings, providers, logout, isInitialized, isLoading, manageService, updateBookingStatus } = useAppStore();
    const router = useRouter();
    const { toast } = useToast();
    const { confirm } = useConfirm();

    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'services' | 'reviews' | 'conversations'>('overview');
    const prevBookingsRef = useRef<Booking[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [consultations, setConsultations] = useState<any[]>([]);
    const [consultationError, setConsultationError] = useState<string | null>(null);
    const [selectedConsultation, setSelectedConsultation] = useState<any>(null);

    // Server-Side Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage] = useState(10);
    const [paginatedBookings, setPaginatedBookings] = useState<Booking[]>([]);
    const [totalBookings, setTotalBookings] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingsError, setBookingsError] = useState<string | null>(null);

    // Maintenance Modals State
    const [isPriceEstimationOpen, setIsPriceEstimationOpen] = useState(false);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [selectedOrderModal, setSelectedOrderModal] = useState<Booking | null>(null);

    const handleAcceptWithPrice = async (price: number) => {
        if (!selectedBookingId) return;
        // Proceed to confirm with the estimated price
        await handleOrderStatus(selectedBookingId, 'confirmed', price);

        // Send notification to customer
        const booking = myBookings.find((b: Booking) => b.id === selectedBookingId);
        if (booking) {
            try {
                await apiCall(`/notifications`, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: booking.userId,
                        message: `تم قبول طلبك! مقدم الخدمة ${myProviderProfile?.name || booking.providerName} وافق على الموعد. رقم التواصل: ${(myProviderProfile as any)?.phone || currentUser?.phone || 'غير متوفر'}`,
                        type: 'order_confirmed',
                        relatedId: booking.id
                    })
                });
            } catch (error) {
                console.error('Failed to send notification:', error);
            }
        }

        // Force reload to immediately show phone numbers
        window.location.reload();
    };

    const handleAcceptAppointment = async (bookingId: string) => {
        try {
            await apiCall(`/bookings/${bookingId}/accept-appointment`, {
                method: 'PATCH',
                body: JSON.stringify({ acceptedBy: 'provider' })
            });

            // Send notification to customer
            const booking = myBookings.find((b: Booking) => b.id === bookingId);
            if (booking) {
                try {
                    await apiCall(`/notifications`, {
                        method: 'POST',
                        body: JSON.stringify({
                            userId: booking.userId,
                            message: `تم قبول طلبك! مقدم الخدمة ${myProviderProfile?.name || booking.providerName} وافق على الموعد. رقم التواصل: ${(myProviderProfile as any)?.phone || currentUser?.phone || 'غير متوفر'}`,
                            type: 'order_confirmed',
                            relatedId: booking.id
                        })
                    });
                } catch (error) {
                    console.error('Failed to send notification:', error);
                }
            }

            toast('تم تأكيد الموعد بنجاح! يمكنك الآن التواصل مع العميل 📞', 'success');
            // Optimistically update local state or reload
            window.location.reload();
        } catch (error) {
            console.error('Accept appointment failed', error);
            toast('حدث خطأ في تأكيد الموعد', 'error');
        }
    };

    // Modified Accept Handler - Immediate contact reveal for maintenance
    const handleAcceptClick = async (booking: Booking) => {
        const isMaintenance = booking.appointmentType === 'maintenance';
        const hasZeroPrice = !booking.price || Number(booking.price) === 0;

        if (isMaintenance && hasZeroPrice) {
            setSelectedBookingId(booking.id);
            setIsPriceEstimationOpen(true);
        } else {
            // Accept the order and IMMEDIATELY reload to reveal phone
            await handleOrderStatus(booking.id, 'confirmed');

            // Send notification to customer
            try {
                await apiCall(`/notifications`, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: booking.userId,
                        message: `تم قبول طلبك! مقدم الخدمة ${myProviderProfile?.name || booking.providerName} وافق على الموعد. رقم التواصل: ${(myProviderProfile as any)?.phone || currentUser?.phone || 'غير متوفر'}`,
                        type: 'order_confirmed',
                        relatedId: booking.id
                    })
                });
            } catch (error) {
                console.error('Failed to send notification:', error);
            }

            // Force reload to immediately show phone numbers
            window.location.reload();
        }
    };

    // Real-time notifications moved to after data loading

    // Calculate derived state safely allowing for null currentUser
    // For Halan providers, load from localStorage
    let myProviderProfile: Provider | undefined = undefined;
    let providerId: string | undefined = undefined;

    if (currentUser) {
        if (currentUser.type === 'provider' && !providers.find(p => String(p.userId) === String(currentUser.id))) {
            // For Halan providers who are not in the 'providers' list yet, use their ID directly
            // This handles the Halan hydration case
            providerId = String(currentUser.id);
        } else {
            // For Qareeblak providers
            myProviderProfile = providers.find((p: Provider) =>
                (p.userId && String(p.userId) === String(currentUser.id)) ||
                (p.email && p.email === currentUser.email)
            );
            providerId = myProviderProfile?.id;
        }
    }

    // Fallback to client-side filtered bookings for overview and real-time updates
    const myBookings = (currentUser && bookings) ? bookings.filter((b: Booking) =>
        (myProviderProfile && b.providerId === myProviderProfile.id) ||
        (b.providerName === currentUser.name && !b.providerId)
    ) : [];

    const myServices = myProviderProfile?.services || [];
    const myReviews = myProviderProfile?.reviewsList || [];

    // Server-side paginated bookings fetch
    const fetchPaginatedBookings = useCallback(async () => {
        if (!providerId) return;

        setBookingsLoading(true);
        setBookingsError(null);

        try {
            const response = await bookingsApi.getByProvider(providerId, currentPage, ordersPerPage);

            if (response && response.bookings) {
                // Backend returns { bookings: [...], pagination: {...} }
                setPaginatedBookings(response.bookings);
                setTotalBookings(response.pagination.total);
                setTotalPages(response.pagination.totalPages);
            } else {
                // Fallback: Backend might return array directly (backward compatibility)
                const bookingsArray = Array.isArray(response) ? response : [];
                setPaginatedBookings(bookingsArray);
                setTotalBookings(bookingsArray.length);
                setTotalPages(Math.ceil(bookingsArray.length / ordersPerPage));
            }
        } catch (error) {
            console.error('Failed to fetch paginated bookings:', error);
            setBookingsError('فشل تحميل الطلبات. حاول مرة أخرى.');
            // Fallback to client-side data
            setPaginatedBookings([]);
            setTotalBookings(0);
            setTotalPages(0);
        } finally {
            setBookingsLoading(false);
        }
    }, [providerId, currentPage, ordersPerPage]);

    // Fetch paginated bookings when provider ID or page changes
    useEffect(() => {
        if (isInitialized && providerId && activeTab === 'orders') {
            fetchPaginatedBookings();
        }
    }, [isInitialized, providerId, currentPage, activeTab, fetchPaginatedBookings]);

    // Use server-paginated bookings for orders tab, fallback to client-side for other tabs
    const displayBookings = activeTab === 'orders' && paginatedBookings.length > 0
        ? paginatedBookings
        : myBookings.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

    const displayTotalPages = activeTab === 'orders' && totalPages > 0
        ? totalPages
        : Math.ceil(myBookings.length / ordersPerPage);

    // Memoized price calculator
    const calculateDisplayPrice = useCallback((booking: Booking) => {
        let displayPrice = Number(booking.price) || 0;
        if (displayPrice === 0) {
            let itemsArr: any[] = [];
            try {
                itemsArr = Array.isArray(booking.items) ? booking.items : JSON.parse(booking.items || "[]");
            } catch (e) { }
            if (itemsArr && itemsArr.length > 0) {
                displayPrice = itemsArr.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
            }
        }
        if (displayPrice === 0) {
            displayPrice = Number(booking.details?.match(/الإجمالي:\s*(\d+)/)?.[1]) || 0;
        }
        if (displayPrice === 0) {
            const originalService = myServices.find((s: any) => s.name === booking.serviceName);
            if (originalService) {
                displayPrice = Number(originalService.price) || 0;
            }
        }
        return displayPrice;
    }, [myServices]);

    // Helper to get display count for pagination UI
    const getDisplayCount = () => {
        if (activeTab === 'orders' && !bookingsLoading) {
            const start = (currentPage - 1) * ordersPerPage + 1;
            const end = Math.min(currentPage * ordersPerPage, totalBookings || displayBookings.length);
            const total = totalBookings || myBookings.length;
            return { start, end, total };
        }
        const start = (currentPage - 1) * ordersPerPage + 1;
        const end = Math.min(currentPage * ordersPerPage, myBookings.length);
        return { start, end, total: myBookings.length };
    };

    // ================= AUTHENTICATION GUARD =================
    useEffect(() => {
        // Wait for initialization to complete
        if (!isInitialized) return;

        // Check authentication
        const qareeblakToken = localStorage.getItem('qareeblak_token');
        const halanToken = localStorage.getItem('halan_token');

        // If no auth token exists at all, redirect to login
        if (!qareeblakToken && !halanToken) {
            console.warn('[ProviderDashboard] No authentication detected. Redirecting to login.');
            router.push('/login/provider');
            return;
        }

        // Now that AppProvider hydrates both Qareeblak and Halan users into currentUser,
        // we can simply check if currentUser exists after initialization.
        if (!currentUser && !isLoading) {
            console.warn('[ProviderDashboard] Token exists but no user loaded (Session Invalid/Expired). Redirecting.');
            // Clear potentially stale tokens
            localStorage.removeItem('qareeblak_token');
            localStorage.removeItem('halan_token');
            router.push('/login/provider');
            return;
        }

        console.log('[ProviderDashboard] Authentication verified for:', currentUser?.name);
    }, [isInitialized, currentUser, isLoading, router]);

    // Fetch consultations automatically (with periodic polling)
    const fetchConsultations = async (pid: string) => {
        if (!isInitialized) return;

        // Don't poll if we already got an auth error
        if (consultationError === 'auth') return;

        try {
            console.log('[ProviderDashboard] Fetching consultations for provider:', pid);

            // Verify we have a token before making the request
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');
            if (!token) {
                console.warn('[ProviderDashboard] No token available for consultations');
                setConsultationError('auth');
                return;
            }

            // USE apiCall instead of manual fetch to ensure correct headers/token
            const data = await apiCall(`/chat/provider/${pid}/consultations`);

            if (data && data.success) {
                setConsultations(data.consultations || []);
                setConsultationError(null); // Clear any previous errors
                console.log('[ProviderDashboard] Consultations loaded:', data.consultations?.length || 0);
            } else {
                console.warn('[ProviderDashboard] API returned success=false', data);
            }
        } catch (err: any) {
            const errorMessage = err?.message || String(err);
            console.error('[ProviderDashboard] Failed to fetch consultations:', errorMessage);

            // If it's an auth error, stop polling
            if (errorMessage.includes('عدم التفويض') || errorMessage.includes('401')) {
                console.warn('[ProviderDashboard] Auth error detected, stopping consultation polling');
                setConsultationError('auth');
            }
        }
    };

    // Auto-fetch consultations on mount and periodically
    // Auto-fetch consultations on mount and periodically
    useEffect(() => {
        if (!providerId) {
            console.warn('[ProviderDashboard] No providerId available, skipping consultation fetch');
            return;
        }

        console.log('[ProviderDashboard] Starting consultation sync for:', providerId);

        // helper to fetch safely
        const syncConsultations = () => {
            fetchConsultations(String(providerId));
        };

        // 1. Initial Fetch
        syncConsultations();

        // 2. Poll every 10 seconds (reduced frequency)
        const interval = setInterval(syncConsultations, 10000);

        // 3. Socket.io for real-time updates
        let socket: any = null;
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const SOCKET_URL = API_URL.replace(/\/api$/, '') || 'http://localhost:5000';

            socket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
            });

            socket.on('connect', () => {
                console.log('[ProviderDashboard] Socket connected');
            });

            socket.on('new-message', (message: any) => {
                console.log('[ProviderDashboard] New message, refreshing...');
                syncConsultations();
            });
        } catch (err) {
            console.error('[ProviderDashboard] Socket setup failed:', err);
        }

        return () => {
            clearInterval(interval);
            if (socket) socket.disconnect();
        };
        // We act on providerId changes. 
        // Note: fetchConsultations is intentionally omitted from deps to avoid infinite loops 
        // if it's not memoized. We trust providerId as the key trigger.
    }, [providerId]);

    // Refetch when entering conversations tab
    useEffect(() => {
        if (activeTab === 'conversations' && providerId) {
            fetchConsultations(String(providerId));
        }
    }, [activeTab, providerId]);

    // Real-time notifications for status changes
    useEffect(() => {
        if (myBookings.length > 0 && prevBookingsRef.current.length > 0) {
            myBookings.forEach(booking => {
                const prev = prevBookingsRef.current.find(b => b.id === booking.id);
                if (prev && prev.status !== booking.status && booking.status === 'cancelled') {
                    toast(`تنبيه: تم إلغاء الطلب #${booking.id.substring(0, 8)} بواسطة العميل`, "error");

                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.play().catch(e => console.log('Audio play blocked'));
                    } catch (e) { }
                }
            });
        }
        prevBookingsRef.current = myBookings;
    }, [myBookings, toast]);

    // Service Form State
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [serviceForm, setServiceForm] = useState({
        name: "",
        description: "",
        price: "",
        image: "",
        hasOffer: false,
        offerType: "discount" as "discount" | "bundle",
        discountPercent: "",
        bundleCount: "",
        bundleFreeCount: "",
        offerEndDate: ""
    });

    const resetServiceForm = () => setServiceForm({
        name: "",
        description: "",
        price: "",
        image: "",
        hasOffer: false,
        offerType: "discount",
        discountPercent: "",
        bundleCount: "",
        bundleFreeCount: "",
        offerEndDate: ""
    });

    // Camera State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null); // Preview before confirming
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const openCamera = async () => {
        try {
            setCapturedPreview(null);
            setIsCameraReady(false);

            // Check if mediaDevices is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast("عذراً، متصفحك لا يدعم الوصول للكاميرا", "error");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            }).catch(err => {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    throw new Error("يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح");
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    throw new Error("عذراً، لم يتم العثور على كاميرا متصلة بالجهاز");
                } else {
                    throw new Error("حدث خطأ أثناء محاولة تشغيل الكاميرا");
                }
            });

            setCameraStream(stream);
            setIsCameraOpen(true);

            // Wait for next render then attach stream
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (videoRef.current) {
                            videoRef.current.play().catch(e => console.error("Video play error:", e));
                            setIsCameraReady(true);
                        }
                    };
                }
            }, 300);
        } catch (err: any) {
            console.error("Camera error:", err);
            toast(err.message || "تعذر الوصول للكاميرا. تأكد من الأذونات.", "error");
        }
    };

    const capturePhoto = () => {
        try {
            if (!videoRef.current) {
                toast("خطأ: الكاميرا غير جاهزة", "error");
                return;
            }

            // Create temporary canvas if canvasRef is not ready
            const canvas = canvasRef.current || document.createElement('canvas');
            const video = videoRef.current;

            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = canvas.toDataURL('image/jpeg', 0.85);

                // Save to preview
                setCapturedPreview(imageData);

                // Stop camera stream while previewing
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }
            } else {
                toast("خطأ في معالجة الصورة", "error");
            }
        } catch (error) {
            console.error("Capture error:", error);
            toast("حدث خطأ أثناء التقاط الصورة", "error");
        }
    };

    const confirmPhoto = () => {
        if (capturedPreview) {
            setServiceForm(prev => ({ ...prev, image: capturedPreview }));
            toast("تم حفظ الصورة بنجاح! ✅", "success");
            setCapturedPreview(null);
            setCameraStream(null);
            setIsCameraReady(false);
            setIsCameraOpen(false);
        }
    };

    const retakePhoto = async () => {
        setCapturedPreview(null);
        setIsCameraReady(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setCameraStream(stream);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (videoRef.current) {
                            videoRef.current.play().catch(e => console.error("Video play error:", e));
                            setIsCameraReady(true);
                        }
                    };
                }
            }, 300);
        } catch (err) {
            console.error("Retake error:", err);
            toast("تعذر إعادة تشغيل الكاميرا", "error");
        }
    };

    const closeCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCapturedPreview(null);
        setIsCameraReady(false);
        setIsCameraOpen(false);
    };

    // ================= AUTHENTICATION GUARD =================
    // CRITICAL: Show loading while initialization is in progress
    if (!isInitialized || isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-background text-primary animate-pulse">جاري التحميل...</div>;
    }

    // Check for both Qareeblak and Halan provider sessions IN LOCALSTORAGE
    // This is crucial - we check localStorage directly, not just the state
    const qareeblakToken = typeof window !== 'undefined' ? localStorage.getItem('qareeblak_token') : null;
    const halanToken = typeof window !== 'undefined' ? localStorage.getItem('halan_token') : null;
    const halanUser = typeof window !== 'undefined' ? localStorage.getItem('halan_user') : null;

    // Session validation logic:
    // 1. Halan session: Must have both token AND user data
    const hasValidHalanSession = !!(halanToken && halanUser);

    // 2. Qareeblak session: Must have token AND (currentUser with provider type OR still loading)
    // IMPORTANT: Don't reject if currentUser is null but token exists (could be loading)
    const hasQareeblakToken = !!qareeblakToken;
    const hasValidQareeblakSession = !!(hasQareeblakToken && currentUser && currentUser.type === 'provider');

    // 3. Still loading user data: If we have a token but no currentUser yet, keep showing loading
    const isStillLoadingUser = hasQareeblakToken && !currentUser && !isLoading;

    if (isStillLoadingUser) {
        console.log('[ProviderDashboard] Token exists but user not loaded yet, waiting...');
        return <div className="min-h-screen flex items-center justify-center bg-background text-primary animate-pulse">جاري التحميل...</div>;
    }

    // Only show unauthorized if BOTH sessions are completely invalid (no tokens at all)
    if (!hasValidQareeblakSession && !hasValidHalanSession && !hasQareeblakToken) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full shadow-2xl text-center p-8 border-border/50 bg-card rounded-[2.5rem]">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LogOut className="w-10 h-10 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3 font-cairo">وصول غير مصرح به</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        عذراً، هذه الصفحة مخصصة لشركاء الخدمة فقط. يرجى تسجيل الدخول بحساب شريك معتمد.
                    </p>
                    <Button
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 text-lg font-bold"
                        onClick={() => {
                            if (currentUser) logout();
                            router.push('/login/provider');
                        }}
                    >
                        تسجيل الدخول كشريك
                    </Button>
                </Card>
            </div>
        );
    }



    // --- Actions ---

    const handleSaveService = async () => {
        if (!serviceForm.name || !serviceForm.price) return;

        if (!providerId) {
            toast("عذراً، لم يتم العثور على حساب مقدم الخدمة الخاص بك. يرجى تسجيل الخروج والدخول مرة أخرى.", "error");
            return;
        }

        const serviceData: any = {
            name: serviceForm.name,
            description: serviceForm.description,
            price: Number(serviceForm.price),
            image: serviceForm.image || undefined
        };

        // Build offer object if enabled
        if (serviceForm.hasOffer) {
            serviceData.offer = {
                type: serviceForm.offerType,
                endDate: serviceForm.offerEndDate || undefined
            };
            if (serviceForm.offerType === 'discount') {
                serviceData.offer.discountPercent = Number(serviceForm.discountPercent) || 0;
            } else {
                serviceData.offer.bundleCount = Number(serviceForm.bundleCount) || 0;
                serviceData.offer.bundleFreeCount = Number(serviceForm.bundleFreeCount) || 1;
            }
        }

        try {
            if (editingServiceId) {
                await manageService(providerId, 'update', { id: editingServiceId, ...serviceData });
                toast("تم تعديل الخدمة بنجاح", "success");
            } else {
                await manageService(providerId, 'add', serviceData);
                toast("تم إضافة الخدمة بنجاح", "success");
            }
            setIsServiceModalOpen(false);
            resetServiceForm();
            setEditingServiceId(null);
        } catch (error) {
            toast("حدث خطأ في حفظ الخدمة", "error");
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!providerId) return;

        const confirmed = await confirm({
            title: 'حذف الخدمة',
            message: 'هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع.',
            confirmText: 'نعم، احذف',
            cancelText: 'إلغاء',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await manageService(providerId, 'delete', { id });
                toast("تم حذف الخدمة", "info");
            } catch (error) {
                toast("حدث خطأ في حذف الخدمة", "error");
            }
        }
    };

    const handleEditService = (service: any) => {
        setServiceForm({
            name: service.name,
            description: service.description || "",
            price: service.price.toString(),
            image: service.image || "",
            hasOffer: !!service.offer,
            offerType: service.offer?.type || "discount",
            discountPercent: service.offer?.discountPercent?.toString() || "",
            bundleCount: service.offer?.bundleCount?.toString() || "",
            bundleFreeCount: service.offer?.bundleFreeCount?.toString() || "",
            offerEndDate: service.offer?.endDate || ""
        });
        setEditingServiceId(service.id);
        setIsServiceModalOpen(true);
    };

    const handleOrderStatus = async (bookingId: string, status: 'confirmed' | 'completed' | 'rejected', price?: number) => {
        try {
            await updateBookingStatus(bookingId, status, price);

            // Check if this is a maintenance booking (skip Halan delivery)
            const providerIsMaintenance = isMaintenanceProvider(myProviderProfile?.category);

            // For maintenance bookings, skip Halan delivery entirely
            if (providerIsMaintenance) {
                if (status === 'confirmed') {
                    toast("تم قبول موعد الصيانة بنجاح ✅", "success");
                } else if (status === 'completed') {
                    toast("تم إتمام خدمة الصيانة بنجاح ✅", "success");
                } else {
                    toast("تم رفض الطلب", "info");
                }
                return;
            }

            // When provider accepts order (confirmed), handle differently based on order type
            if (status === 'confirmed') {
                try {
                    const booking = myBookings.find((b: Booking) => b.id === bookingId);
                    if (booking) {
                        // ═══════════════════════════════════════════════════════
                        // GUARD CLAUSE: Manual orders already have a delivery order!
                        // If halanOrderId exists, this is a MANUAL order created by Admin/Courier.
                        // DO NOT create a new delivery order — just update the existing one's status.
                        // ═══════════════════════════════════════════════════════
                        if (booking.halanOrderId) {
                            console.log(`[Provider] Manual order detected (halanOrderId: ${booking.halanOrderId}). Skipping order creation.`);
                            // Just update the existing delivery order status to 'confirmed' (provider accepted)
                            try {
                                await apiCall(`/halan/orders/${booking.halanOrderId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ status: 'pending' }) // Keep pending until prepared
                                });
                            } catch (e) {
                                console.error('Failed to sync manual order status:', e);
                            }
                            toast(`تم قبول الطلب! اضغط 'تم التجهيز' عند الانتهاء.`, "success");
                            return;
                        }

                        // ═══════════════════════════════════════════════════════
                        // APP ORDER: No existing delivery order — create one for Qareeblak app flow
                        // ═══════════════════════════════════════════════════════
                        // 1. Fetch latest items from Halan tracking endpoint to get any customer modifications
                        let currentItems = booking.items || [];
                        try {
                            const latestData = await apiCall(`/halan/orders/track/${booking.id}`);
                            if (latestData.success && latestData.order && latestData.order.items) {
                                currentItems = typeof latestData.order.items === 'string'
                                    ? JSON.parse(latestData.order.items)
                                    : latestData.order.items;
                            }
                        } catch (e) {
                            console.error('Failed to fetch latest items before acceptance:', e);
                        }

                        // Extract actual item and price from details if generic name is found
                        const details = booking.details || "";
                        const itemMatch = details.match(/الطلبات:\s*(.*?)\s*x\d+/);
                        const priceMatch = details.match(/الإجمالي:\s*(\d+)/);

                        const actualItemName = itemMatch ? itemMatch[1] : booking.serviceName;
                        const actualPrice = priceMatch ? parseFloat(priceMatch[1]) : (booking.price || 0);

                        const orderItems = (currentItems && currentItems.length > 0)
                            ? currentItems.map(item => ({
                                name: item.name || item.product_name,
                                quantity: Number(item.quantity) || 1,
                                price: Number(item.price) || 0
                            }))
                            : [{ name: actualItemName, quantity: 1, price: actualPrice }];

                        // Create the order in Halan delivery system (APP orders only)
                        const orderData: any = {
                            customerName: booking.userName || 'عميل مجهول',
                            customerPhone: booking.details?.match(/الهاتف:\s*([^|]+)/)?.[1]?.trim() || '',
                            pickupAddress: currentUser?.name || 'المحل',
                            deliveryAddress: booking.details?.match(/العنوان:\s*([^|]+)/)?.[1]?.trim() || 'غير محدد',
                            notes: booking.details || '',
                            products: orderItems,
                            deliveryFee: 0, // Fee will be set by courier later
                            status: 'confirmed',
                            autoAssign: true,
                            courierId: null,
                            source: 'qareeblak',
                            orderType: 'app' // Explicitly mark as app order
                        };

                        const createResult = await apiCall('/halan/orders', {
                            method: 'POST',
                            body: JSON.stringify(orderData)
                        });

                        if (createResult.success && createResult.data?.id) {
                            // 1. Save Halan internal ID FIRST
                            await bookingsApi.update(bookingId, { halanOrderId: createResult.data.id });

                            // 2. Then update status which reloads the list
                            await updateBookingStatus(bookingId, 'confirmed');

                            toast(`تم قبول الطلب! اضغط 'تم التجهيز' عند الانتهاء لإرساله للمناديب`, "success");
                            return;
                        }
                    }
                } catch (halanError) {
                    console.error('Halan integration error:', halanError);
                }
                toast("تم قبول الطلب - جاري التنفيذ", "success");
                return;
            }

            // When provider marks order ready (completed preparation)
            if (status === 'completed') {
                // Also update Halan order status to 'ready_for_pickup' (Stage 3)
                const booking = myBookings.find((b: Booking) => b.id === bookingId);
                if (booking?.halanOrderId) {
                    try {
                        // Update order status to ready_for_pickup
                        await apiCall(`/halan/orders/${booking.halanOrderId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ status: 'ready_for_pickup' })
                        });

                        // Publish order to couriers
                        await apiCall(`/halan/orders/${booking.halanOrderId}/publish`, {
                            method: 'POST'
                        }).catch(() => { });
                    } catch (e) {
                        console.error('Failed to update order status:', e);
                    }
                }
                toast("تم إتمام الطلب - جاهز للاستلام من المندوب", "success");
                return;
            }

            // Rejected status
            toast("تم رفض الطلب", "info");
        } catch (error) {
            toast("حدث خطأ في تحديث الطلب", "error");
        }
    };


    return (
        <div className="min-h-screen bg-background text-foreground dir-rtl flex transition-colors duration-500">

            {/* Sidebar (Desktop) */}
            <aside className="w-64 bg-card text-card-foreground border-l border-border/50 hidden md:flex flex-col fixed h-full right-0 z-10 transition-all">
                <div className="p-8 border-b border-border/50 bg-muted/20">
                    <h2 className="text-2xl font-black flex items-center gap-3 font-cairo">
                        <LayoutDashboard className="text-primary w-6 h-6" />
                        لوحة الشركاء
                    </h2>
                    <p className="text-xs text-muted-foreground mt-2 font-bold opacity-80">مرحباً، {currentUser?.name || 'شريكنا العزيز'}</p>
                </div>

                <nav className="flex-1 p-6 space-y-3">
                    <Button
                        variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        نظرة عامة
                    </Button>
                    <Button
                        variant={activeTab === 'orders' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'orders' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        <ShoppingBag className="w-5 h-5" />
                        الطلبات ({myBookings.filter((b: Booking) => b.status === 'pending').length})
                    </Button>
                    <Button
                        variant={activeTab === 'services' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'services' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('services')}
                    >
                        <Utensils className="w-5 h-5" />
                        المنيو / الخدمات
                    </Button>
                    <Button
                        variant={activeTab === 'reviews' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'reviews' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('reviews')}
                    >
                        <Star className="w-5 h-5" />
                        التقييمات
                    </Button>
                </nav>

                {/* Specific Tab for Pharmacy/Medical Providers */}
                {isPharmacyProvider(myProviderProfile?.category) && (
                    <div className="px-6 pb-2">
                        <Button
                            variant={activeTab === 'conversations' ? 'secondary' : 'ghost'}
                            className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all relative ${activeTab === 'conversations' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'}`}
                            onClick={() => setActiveTab('conversations')}
                        >
                            <MessageSquare className="w-5 h-5" />
                            المحادثات الطبية
                            {/* Unread Badge */}
                            {consultations.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0) > 0 && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 animate-pulse">
                                    {consultations.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0)}
                                </span>
                            )}
                        </Button>
                    </div>
                )}

                <div className="p-6 border-t border-border/50">
                    <Button
                        variant="destructive"
                        className="w-full h-12 justify-start gap-4 rounded-xl font-bold"
                        onClick={() => { logout(); router.push('/login/provider'); }}
                    >
                        <LogOut className="w-5 h-5" />
                        تسجيل الخروج
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 md:mr-64 transition-all w-full min-h-screen">
                {/* Glowing background orbs */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
                <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] -z-10" />

                <div className="w-full space-y-10 relative z-10">

                    {/* Header Mobile */}
                    <div className="md:hidden flex items-center justify-between p-4 bg-card rounded-2xl border border-border/50 shadow-lg">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black text-foreground font-cairo">لوحة الشركاء</h1>
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive font-bold h-10 px-4 rounded-xl" onClick={() => logout()}>خروج</Button>
                    </div>

                    {/* 1. OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                            <div className="grid gap-6 md:grid-cols-3">
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-primary/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-primary/10 rounded-2xl text-primary transition-colors group-hover:bg-primary/20">
                                            <ShoppingBag className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">الطلبات الجديدة</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">{myBookings.filter((b: Booking) => ['pending', 'new', 'جديد'].includes(b.status)).length}</h3>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-secondary/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-secondary/10 rounded-2xl text-secondary transition-colors group-hover:bg-secondary/20">
                                            <TrendingUp className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">إجمالي المبيعات</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">
                                                {myBookings
                                                    .filter((b: Booking) => {
                                                        const s = String(b.status || '').toLowerCase().trim();
                                                        return [
                                                            'completed', 'delivered', 'picked_up', 'in_transit',
                                                            'تم التجهيز', 'مكتمل', 'تم التوصيل', 'مكتملة',
                                                            'arkived', 'archived', 'تم استلام من المطعم', 'مع المندوب'
                                                        ].includes(s);
                                                    })
                                                    .reduce((sum: number, b: Booking) => {
                                                        // 1. Try structured price
                                                        const p = parseFloat(String(b.price || 0));

                                                        // 2. Try to sum items if price is 0
                                                        let itemsTotal = 0;
                                                        if (p === 0) {
                                                            let itemsArr = [];
                                                            try {
                                                                itemsArr = Array.isArray(b.items) ? b.items : JSON.parse(b.items || "[]");
                                                            } catch (e) { }
                                                            if (itemsArr && itemsArr.length > 0) {
                                                                itemsTotal = itemsArr.reduce((s: number, i: any) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                                            }
                                                        }

                                                        // 3. Fallback to details regex if both are 0
                                                        let extracted = 0;
                                                        if (p === 0 && itemsTotal === 0) {
                                                            extracted = parseFloat(b.details?.match(/الإجمالي:\s*(\d+)/)?.[1] || '0');
                                                        }

                                                        return sum + (p || itemsTotal || extracted || 0);
                                                    }, 0)} <span className="text-base font-bold text-muted-foreground">ج.م</span>
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-amber-500/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-amber-500/10 rounded-2xl text-amber-500 transition-colors group-hover:bg-amber-500/20">
                                            <Star className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">التقييم العام</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">
                                                {myProviderProfile?.rating ? Number(myProviderProfile.rating).toFixed(1) : "0.0"}
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b border-border/50 px-10 py-8">
                                    <CardTitle className="text-2xl font-black text-foreground font-cairo">آخر 5 طلبات</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-muted/50 text-muted-foreground font-black font-cairo border-b border-border/50">
                                                <tr>
                                                    <th className="px-10 py-6 text-foreground/80">العميل</th>
                                                    <th className="px-10 py-6 text-foreground/80">الخدمة</th>
                                                    <th className="px-10 py-6 text-foreground/80">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50 font-medium font-cairo">
                                                {myBookings.slice(0, 5).map((booking: Booking, i: number) => (
                                                    <tr key={i} className="hover:bg-muted/20 transition-all group">
                                                        <td className="px-10 py-6 font-black text-foreground text-lg">{booking.userName}</td>
                                                        <td className="px-10 py-6 text-muted-foreground">{booking.serviceName}</td>
                                                        <td className="px-10 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black
                                                                    ${booking.status === 'pending' || booking.status === 'pending_appointment' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                                                    booking.status === 'confirmed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                                        booking.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                            booking.status === 'cancelled' || booking.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                                'bg-muted/50 text-muted-foreground border border-border/50'}`}>
                                                                {booking.status === 'pending' ? 'جديد' :
                                                                    booking.status === 'pending_appointment' ? 'بانتظار الموعد' :
                                                                        booking.status === 'confirmed' ? 'جاري التنفيذ' :
                                                                            booking.status === 'completed' ? 'مكتمل' :
                                                                                booking.status === 'cancelled' ? 'ملغي من العميل' :
                                                                                    booking.status === 'rejected' ? 'مرفوض' : booking.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {myBookings.length === 0 && (
                                                    <tr><td colSpan={3} className="text-center py-20 text-muted-foreground font-bold">لا توجد طلبات بعد</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* 2. SERVICES TAB */}
                    {activeTab === 'services' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-card/50 p-6 rounded-[2rem] border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h2 className="text-3xl font-black text-foreground font-cairo">الخدمات / المنيو</h2>
                                    <p className="text-muted-foreground font-medium mt-1 font-cairo">أضف عدل أو احذف خدماتك المعروضة للعملاء</p>
                                </div>
                                <Dialog open={isServiceModalOpen} onOpenChange={(open: boolean) => {
                                    if (open) setIsServiceModalOpen(true);
                                }}>
                                    <DialogTrigger asChild>
                                        <Button
                                            onClick={() => { resetServiceForm(); setEditingServiceId(null); }}
                                            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white gap-3 h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 text-lg font-black font-cairo"
                                        >
                                            <Plus className="w-6 h-6" /> إضافة خدمة جديدة
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent
                                        className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border rounded-[2.5rem] p-8 text-foreground"
                                        onInteractOutside={(e: Event) => e.preventDefault()}
                                        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
                                    >
                                        <DialogHeader className="flex flex-row items-center justify-between border-b border-border pb-6 mb-6">
                                            <DialogTitle className="text-2xl font-black font-cairo text-foreground">{editingServiceId ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
                                            <button
                                                type="button"
                                                onClick={() => setIsServiceModalOpen(false)}
                                                title="إغلاق"
                                                className="p-3 hover:bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-all"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </DialogHeader>
                                        <div className="space-y-6 py-2">
                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">اسم الخدمة / الأكلة <span className="text-destructive">*</span></Label>
                                                <Input className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 font-bold text-foreground transition-all" value={serviceForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="مثال: بيتزا مشكل جبن" />
                                            </div>

                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">الوصف <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                                                <Input className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 text-foreground transition-all" value={serviceForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="مكونات أو تفاصيل الخدمة" />
                                            </div>

                                            <div className="space-y-3 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">صورة الخدمة <span className="text-muted-foreground text-xs">(اختياري)</span></Label>

                                                {serviceForm.image && (
                                                    <div className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-border bg-background shadow-inner">
                                                        <img src={serviceForm.image} alt="معاينة" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setServiceForm({ ...serviceForm, image: "" })}
                                                            title="حذف الصورة"
                                                            className="absolute top-4 left-4 bg-destructive text-white p-2 rounded-xl hover:bg-destructive/90 transition-all shadow-lg"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {!serviceForm.image && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <label className="cursor-pointer group">
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setServiceForm({ ...serviceForm, image: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                            <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-2xl bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all">
                                                                <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <span className="text-sm font-bold font-cairo text-muted-foreground group-hover:text-foreground">رفع صورة</span>
                                                            </div>
                                                        </label>

                                                        <button
                                                            type="button"
                                                            onClick={openCamera}
                                                            title="التقاط صورة"
                                                            className="group"
                                                        >
                                                            <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-2xl bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all h-full w-full text-muted-foreground group-hover:text-foreground">
                                                                <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <span className="text-sm font-bold font-cairo">الكاميرا</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">السعر (ج.م) <span className="text-destructive">*</span></Label>
                                                <Input type="number" className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 font-black text-lg text-foreground" value={serviceForm.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, price: e.target.value })} placeholder="0" />
                                            </div>

                                            <div className="border-t border-border pt-6 mt-6">
                                                <div className="flex items-center gap-3 mb-5">
                                                    <input type="checkbox" id="hasOffer" title="إضافة عرض" checked={serviceForm.hasOffer} onChange={(e) => setServiceForm({ ...serviceForm, hasOffer: e.target.checked })} className="w-5 h-5 accent-primary rounded-lg" />
                                                    <Label htmlFor="hasOffer" className="cursor-pointer font-black font-cairo text-foreground">إضافة عرض ترويجي (خصم أو بونص)</Label>
                                                </div>

                                                {serviceForm.hasOffer && (
                                                    <div className="bg-background/50 p-6 rounded-2xl space-y-5 border border-border shadow-inner">
                                                        <div className="space-y-3">
                                                            <Label className="font-bold font-cairo block text-right text-muted-foreground">نوع العرض</Label>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <Button type="button" className={`h-11 rounded-xl font-bold font-cairo transition-all ${serviceForm.offerType === 'discount' ? 'bg-primary text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`} onClick={() => setServiceForm({ ...serviceForm, offerType: 'discount' })}>نسبة خصم %</Button>
                                                                <Button type="button" className={`h-11 rounded-xl font-bold font-cairo transition-all ${serviceForm.offerType === 'bundle' ? 'bg-primary text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`} onClick={() => setServiceForm({ ...serviceForm, offerType: 'bundle' })}>عرض بونص (X+Y)</Button>
                                                            </div>
                                                        </div>

                                                        {serviceForm.offerType === 'discount' && (
                                                            <div className="space-y-2 text-right">
                                                                <Label className="font-bold font-cairo text-muted-foreground">نسبة الخصم %</Label>
                                                                <div className="flex items-center gap-3">
                                                                    <Input type="number" className="h-12 w-24 rounded-xl bg-background border-border text-center font-black text-xl text-foreground" value={serviceForm.discountPercent} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, discountPercent: e.target.value })} placeholder="10" min="1" max="100" />
                                                                    <span className="text-foreground font-black text-xl">%</span>
                                                                    {serviceForm.discountPercent && serviceForm.price && (
                                                                        <span className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-sm font-black border border-emerald-500/20 mr-auto">
                                                                            سيصبح السعر: {Math.round(Number(serviceForm.price) * (1 - Number(serviceForm.discountPercent) / 100))} ج.م
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {serviceForm.offerType === 'bundle' && (
                                                            <div className="space-y-3 text-right">
                                                                <Label className="font-bold font-cairo text-muted-foreground">تفاصيل عرض البونص</Label>
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span className="font-bold font-cairo text-muted-foreground">اشتري</span>
                                                                    <Input type="number" className="h-12 w-20 rounded-xl bg-background border-border text-center font-black text-lg text-foreground" value={serviceForm.bundleCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleCount: e.target.value })} placeholder="3" />
                                                                    <span className="font-bold font-cairo text-muted-foreground">وخد</span>
                                                                    <Input type="number" className="h-12 w-20 rounded-xl bg-background border-border text-center font-black text-lg text-foreground" value={serviceForm.bundleFreeCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleFreeCount: e.target.value })} placeholder="1" />
                                                                    <span className="font-bold font-cairo text-muted-foreground">هدية</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-2 text-right">
                                                            <Label className="font-bold font-cairo text-muted-foreground">تاريخ انتهاء العرض</Label>
                                                            <Input type="date" className="h-12 rounded-xl bg-background border-border text-right font-bold text-foreground" value={serviceForm.offerEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, offerEndDate: e.target.value })} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <DialogFooter className="border-t border-border pt-8 mt-6">
                                            <Button onClick={handleSaveService} className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/20 transition-all active:scale-95">حفظ التغييرات</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {myServices.map((service: any) => (
                                    <Card key={service.id} className="group hover:border-primary/50 transition-all overflow-hidden bg-card border-border/50 rounded-[2rem] shadow-xl flex flex-col">
                                        {service.image && (
                                            <div className="h-44 w-full overflow-hidden bg-muted relative">
                                                <img src={service.image} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        )}

                                        <CardHeader className="flex flex-row items-start justify-between pb-4 px-6 pt-6 gap-4">
                                            <div className="flex-1 text-right">
                                                <CardTitle className="text-xl font-black font-cairo text-foreground">{service.name}</CardTitle>
                                                <CardDescription className="line-clamp-2 mt-2 font-medium text-muted-foreground/80">{service.description}</CardDescription>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {service.offer ? (
                                                    <>
                                                        <span className="line-through text-muted-foreground/50 text-xs font-bold">{service.price} <small>ج.م</small></span>
                                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-lg font-black">
                                                            {service.offer.type === 'discount'
                                                                ? `${Math.round(service.price * (1 - (service.offer.discountPercent || 0) / 100))}`
                                                                : `${service.price}`
                                                            } <small className="text-[10px]">ج.م</small>
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="bg-muted px-4 py-2 rounded-xl text-lg font-black text-foreground border border-border/50">
                                                        {service.price} <small className="text-[10px]">ج.م</small>
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>

                                        {service.offer && (
                                            <div className="px-6 pb-2">
                                                <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-2xl text-xs font-black inline-flex items-center gap-2 font-cairo">
                                                    <span>🎁</span>
                                                    {service.offer.type === 'discount'
                                                        ? `خصم ${service.offer.discountPercent}% لفترة محدودة`
                                                        : `اشتري ${service.offer.bundleCount} وخد ${service.offer.bundleFreeCount} هدية!`
                                                    }
                                                </div>
                                            </div>
                                        )}

                                        <CardContent className="mt-auto px-6 pb-6 pt-4">
                                            <div className="flex gap-3 pt-6 border-t border-border/50">
                                                <Button size="sm" variant="outline" className="flex-1 h-12 gap-2 rounded-xl font-black font-cairo border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all" onClick={() => handleEditService(service)}>
                                                    <Edit className="w-5 h-5" /> تعديل
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    title="حذف الخدمة"
                                                    className="h-12 w-12 rounded-xl"
                                                    onClick={() => handleDeleteService(service.id)}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {myServices.length === 0 && (
                                    <div className="col-span-full text-center py-24 bg-card border-2 border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground space-y-4">
                                        <Utensils className="w-20 h-20 mx-auto opacity-10" />
                                        <p className="text-xl font-black font-cairo">لا توجد خدمات مضافة حالياً</p>
                                        <p className="font-medium max-w-xs mx-auto">ابدأ بزيادة مبيعاتك وأضف مأكولاتك أو خدماتك الآن!</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* 3. ORDERS TAB */}
                    {activeTab === 'orders' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-foreground font-cairo">إدارة الطلبات</h2>
                                <div className="text-sm font-bold bg-card border border-border/50 px-4 py-2 rounded-xl text-muted-foreground flex items-center gap-2">
                                    {bookingsLoading && <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>}
                                    {totalBookings || myBookings.length} طلب إجمالي
                                </div>
                            </div>
                            <Card className="bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-muted/50 text-muted-foreground font-black font-cairo border-b border-border/50">
                                                <tr>
                                                    <th className="px-8 py-6">رقم الطلب</th>
                                                    <th className="px-8 py-6">العميل</th>
                                                    <th className="px-8 py-6">الخدمة</th>
                                                    <th className="px-8 py-6">السعر</th>
                                                    <th className="px-8 py-6">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50 font-medium font-cairo">
                                                {bookingsLoading ? (
                                                    <tr>
                                                        <td colSpan={5} className="text-center py-24">
                                                            <div className="flex flex-col items-center gap-4">
                                                                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                                <p className="text-sm font-bold text-muted-foreground">جاري تحميل الطلبات...</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : bookingsError ? (
                                                    <tr>
                                                        <td colSpan={5} className="text-center py-24">
                                                            <div className="flex flex-col items-center gap-4">
                                                                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                                                                    <span className="text-3xl">⚠️</span>
                                                                </div>
                                                                <p className="text-sm font-bold text-destructive">{bookingsError}</p>
                                                                <button
                                                                    onClick={fetchPaginatedBookings}
                                                                    className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
                                                                >
                                                                    إعادة المحاولة
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : displayBookings.map((booking: Booking) => {
                                                    const displayPrice = calculateDisplayPrice(booking);

                                                    return (
                                                        <tr
                                                            key={booking.id}
                                                            className="hover:bg-muted/30 transition-all cursor-pointer group"
                                                            onClick={() => setSelectedOrderModal(booking)}
                                                        >
                                                            <td className="px-8 py-6 font-mono text-muted-foreground/60 text-xs">#{booking.id.substring(0, 8)}</td>
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20 shrink-0">
                                                                        {booking.userName?.[0] || '؟'}
                                                                    </div>
                                                                    <span className="font-black text-foreground text-base">{booking.userName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6 text-foreground/80 font-bold">{booking.serviceName}</td>
                                                            <td className="px-8 py-6">
                                                                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-black">
                                                                    {displayPrice} ج.م
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase
                                                                    ${booking.status === 'pending' || booking.status === 'pending_appointment' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                                                        booking.status === 'confirmed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                                            booking.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                                booking.status === 'cancelled' || booking.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                                    booking.status === 'provider_rescheduled' || booking.status === 'customer_rescheduled' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                                                        'bg-muted/50 text-muted-foreground border border-border/50'}`}>
                                                                    {booking.status === 'pending' ? 'جديد' :
                                                                        booking.status === 'pending_appointment' ? 'بانتظار الموعد' :
                                                                            booking.status === 'confirmed' ? 'جاري التنفيذ' :
                                                                                booking.status === 'completed' ? 'مكتمل' :
                                                                                    booking.status === 'cancelled' ? 'ملغي من العميل' :
                                                                                        booking.status === 'rejected' ? 'مرفوض' :
                                                                                            booking.status === 'provider_rescheduled' ? 'بانتظار رد العميل' :
                                                                                                booking.status === 'customer_rescheduled' ? 'العميل اقترح موعداً' :
                                                                                                    booking.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {!bookingsLoading && !bookingsError && displayBookings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="text-center py-24 text-muted-foreground">
                                                            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                                            <p className="text-lg font-black font-cairo">لا توجد طلبات حتى الآن</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {displayTotalPages > 1 && !bookingsLoading && (
                                        <div className="flex items-center justify-between px-8 py-6 border-t border-border/50 bg-muted/20">
                                            <div className="text-sm text-muted-foreground font-bold">
                                                {(() => {
                                                    const { start, end, total } = getDisplayCount();
                                                    return `عرض ${start}-${end} من ${total}`;
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={currentPage === 1 || bookingsLoading}
                                                    className="px-4 py-2 rounded-xl font-bold text-sm bg-background border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent transition-colors"
                                                >
                                                    السابق
                                                </button>
                                                <div className="flex gap-1">
                                                    {Array.from({ length: Math.min(5, displayTotalPages) }, (_, i) => {
                                                        const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                                                        if (pageNum > displayTotalPages) return null;
                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => setCurrentPage(pageNum)}
                                                                disabled={bookingsLoading}
                                                                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all disabled:cursor-not-allowed ${currentPage === pageNum
                                                                    ? 'bg-primary text-white shadow-lg'
                                                                    : 'bg-background border border-border hover:bg-accent'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.min(displayTotalPages, prev + 1))}
                                                    disabled={currentPage === displayTotalPages || bookingsLoading}
                                                    className="px-4 py-2 rounded-xl font-bold text-sm bg-background border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent transition-colors"
                                                >
                                                    التالي
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* 4. REVIEWS TAB */}
                    {activeTab === 'reviews' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-foreground font-cairo">آراء العملاء</h2>
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl">
                                    <span className="text-amber-400 text-lg">⭐</span>
                                    <span className="font-black text-amber-500">
                                        {myProviderProfile?.rating ? Number(myProviderProfile.rating).toFixed(1) : "0.0"}
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-6 md:grid-cols-2">
                                {myReviews.map((review: Review) => (
                                    <Card key={review.id} className="bg-card border-border/50 rounded-[2rem] shadow-xl hover:border-primary/50 transition-all">
                                        <CardContent className="p-8">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4 text-right">
                                                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center font-black text-xl text-primary border border-border/50">
                                                        {review.userName[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-lg text-foreground font-cairo">{review.userName}</h3>
                                                        <p className="text-xs text-muted-foreground font-bold mt-1">{review.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'opacity-20'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute -top-4 -right-2 text-6xl text-primary/10 select-none">"</span>
                                                <p className="text-foreground/80 font-bold leading-relaxed pr-2 font-cairo">
                                                    {review.comment}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {myReviews.length === 0 && (
                                    <div className="col-span-full text-center py-24 bg-card border-2 border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground space-y-4">
                                        <Star className="w-20 h-20 mx-auto opacity-10" />
                                        <p className="text-xl font-black font-cairo">لا توجد تقييمات بعد</p>
                                        <p className="font-medium max-w-xs mx-auto">عندما يقوم العملاء بتقييم خدماتك، ستظهر آراؤهم هنا.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}



                    {/* 5. CONVERSATIONS TAB (Updated) */}
                    {activeTab === 'conversations' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-black text-foreground font-cairo">المحادثات الطبية</h2>
                                    <p className="text-muted-foreground font-medium mt-1 font-cairo">تواصل مع المرضى والعملاء مباشرة</p>
                                </div>
                                <Button
                                    onClick={() => {
                                        if (providerId) {
                                            fetchConsultations(providerId);
                                        }
                                    }}
                                    variant="outline"
                                    size="sm"
                                >
                                    تحديث
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                {consultations.map((consultation) => (
                                    <div key={consultation.id} className="bg-card border border-border/50 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 relative">
                                                <User className="w-8 h-8" />
                                                {Number(consultation.unread_count) > 0 && (
                                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                                                        {consultation.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-foreground font-cairo">{consultation.customer_name || 'مستخدم زائر'}</h3>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                    <span className="bg-muted px-2 py-0.5 rounded-lg text-xs font-bold">#{String(consultation.id).substring(0, 8)}</span>
                                                    <span>• {consultation.last_message ? (consultation.last_message.substring(0, 30) + (consultation.last_message.length > 30 ? '...' : '')) : 'بدء محادثة'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                            <div className="text-left hidden md:block">
                                                <div className="text-sm font-bold text-muted-foreground">
                                                    {new Date(consultation.updated_at).toLocaleDateString('ar-EG')}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {new Date(consultation.updated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => {
                                                    setSelectedConsultation({
                                                        id: consultation.id,
                                                        customer_id: consultation.customer_id,
                                                        provider_id: Number(providerId),
                                                        customer_name: consultation.customer_name || 'مستخدم زائر',
                                                        status: consultation.status,
                                                    });
                                                    setChatOpen(true);
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-12 rounded-xl font-black font-cairo shadow-lg shadow-emerald-500/20 w-full md:w-auto"
                                            >
                                                <MessageSquare className="w-5 h-5 ml-2" />
                                                فتح المحادثة
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {consultations.length === 0 && (
                                    <div className="text-center py-24 bg-card border-2 border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground space-y-4">
                                        <MessageSquare className="w-20 h-20 mx-auto opacity-10" />
                                        <p className="text-xl font-black font-cairo">لا توجد محادثات نشطة</p>
                                        <p className="font-medium max-w-xs mx-auto">ستظهر هنا الرسائل الجديدة من العملاء.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                </div>
            </main>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div
                    className="fixed inset-0 z-[10000] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6 pointer-events-auto text-foreground"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-card rounded-[2.5rem] max-w-xl w-full overflow-hidden shadow-2xl border border-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-black text-xl flex items-center gap-3 font-cairo text-foreground">
                                {capturedPreview ? '✅ معاينة الصورة' : '📷 التقاط صورة للخدمة'}
                            </h3>
                            <button onClick={closeCamera} title="إغلاق" className="p-3 hover:bg-destructive/10 rounded-2xl text-muted-foreground hover:text-destructive transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="relative bg-black aspect-video shadow-inner">
                            {capturedPreview ? (
                                <img
                                    src={capturedPreview}
                                    alt="معاينة الصورة"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    {!isCameraReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/50 backdrop-blur-sm">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4 shadow-xl"></div>
                                                <p className="font-black font-cairo text-lg">جاري تجهيز الكاميرا...</p>
                                            </div>
                                        </div>
                                    )}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover grayscale-[0.2] contrast-[1.1]"
                                    />
                                    <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
                                </>
                            )}
                        </div>

                        <div className="p-8 flex justify-center gap-4 bg-muted/20">
                            {capturedPreview ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={confirmPhoto}
                                        className="flex-1 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xl py-5 rounded-2xl font-black font-cairo shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        <Check className="w-7 h-7" />
                                        استخدام الصورة
                                    </button>
                                    <button
                                        type="button"
                                        onClick={retakePhoto}
                                        className="flex-1 flex items-center justify-center gap-3 bg-muted border border-border hover:bg-accent text-foreground text-xl py-5 rounded-2xl font-black font-cairo transition-all"
                                    >
                                        <Camera className="w-6 h-6" />
                                        إعادة تصوير
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={capturePhoto}
                                        disabled={!isCameraReady}
                                        className={`flex-1 flex items-center justify-center gap-3 text-white text-xl py-5 rounded-2xl font-black font-cairo shadow-2xl transition-all active:scale-95 ${isCameraReady ? 'bg-primary hover:bg-primary/90 shadow-primary/20' : 'bg-muted cursor-not-allowed text-muted-foreground'}`}
                                    >
                                        <Camera className="w-7 h-7" />
                                        {isCameraReady ? 'التقاط الصورة' : 'برجاء الانتظار...'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeCamera}
                                        className="px-8 border border-border hover:bg-accent text-muted-foreground hover:text-foreground text-lg rounded-2xl font-bold font-cairo transition-all"
                                    >
                                        إلغاء
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Consultation Chat Modal */}
            {chatOpen && selectedConsultation && providerId && (
                <ConsultationChat
                    isOpen={chatOpen}
                    onClose={() => {
                        setChatOpen(false);
                        setSelectedConsultation(null);
                    }}
                    consultation={selectedConsultation}
                    providerId={String(providerId)}
                />
            )}

            {/* Order Detail Modal */}
            <OrderDetailModal
                booking={selectedOrderModal}
                isOpen={!!selectedOrderModal}
                onClose={() => setSelectedOrderModal(null)}
                onAccept={(b) => { handleAcceptClick(b); setSelectedOrderModal(null); }}
                onAcceptAppointment={(id) => { handleAcceptAppointment(id); setSelectedOrderModal(null); }}
                onReschedule={() => { /* Reschedule removed */ }}
                onReject={(id) => {
                    // Block rejection for manual orders
                    const b = myBookings.find((bk: Booking) => bk.id === id);
                    if (b?.serviceName?.includes('طلب يدوي')) {
                        toast('لا يمكن رفض الطلبات اليدوية - تواصل مع الإدارة', 'error');
                        return;
                    }
                    handleOrderStatus(id, 'rejected');
                    setSelectedOrderModal(null);
                }}
                onComplete={async (id) => {
                    const b = myBookings.find((bk: Booking) => bk.id === id);
                    await handleOrderStatus(id, 'completed');
                    toast(b?.appointmentType === 'maintenance' ? 'تم إتمام خدمة الصيانة ✅' : 'تم تجهيز الطلب وإسناده للمندوب', 'success');
                    setSelectedOrderModal(null);
                }}
                isPharmacy={isPharmacyProvider(myProviderProfile?.category)}
                providerCategory={myProviderProfile?.category}
                isManualOrder={selectedOrderModal?.serviceName?.includes('طلب يدوي') || false}
                onOpenChat={(b) => {
                    setSelectedConsultation({
                        id: `${providerId}-order-${b.id}`,
                        customer_id: 0,
                        provider_id: Number(providerId),
                        customer_name: b.userName,
                        status: 'active',
                    });
                    setChatOpen(true);
                    setSelectedOrderModal(null);
                }}
                servicePrice={myServices.find(s => s.name === selectedOrderModal?.serviceName)?.price}
            />

            {/* Maintenance Modals */}
            <PriceEstimationModal
                isOpen={isPriceEstimationOpen}
                onClose={() => setIsPriceEstimationOpen(false)}
                onConfirm={handleAcceptWithPrice}
            />
        </div>
    );
}
