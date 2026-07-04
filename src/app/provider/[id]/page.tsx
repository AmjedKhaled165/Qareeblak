"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useCartStore } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Phone, User, Calendar, MessageSquare, ShoppingBag, Utensils, Tag, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CartModal } from "@/components/features/cart-modal";
import { isPharmacyProvider, isMaintenanceProvider, isDoctorProvider, isCarServiceProvider } from "@/lib/category-utils";
import { PharmacyProviderLayout } from "@/components/providers/PharmacyProviderLayout";
import { MaintenanceBookingModal } from "@/components/features/maintenance-booking-modal";
import { DoctorBookingModal } from "@/components/features/doctor-booking-modal";
import { PlaygroundsBookingModal } from "@/components/features/playgrounds-booking-modal";
import { apiCall } from "@/lib/api";

// Type definitions
interface Review {
    id: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
}

interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    offer?: {
        type: 'discount' | 'bundle';
        discountPercent?: number;
        bundleCount?: number;
        bundleFreeCount?: number;
        endDate?: string;
        expiresAt?: string;
    };
}

interface Provider {
    id: string;
    name: string;
    category: string;
    location: string;
    phone?: string;
    joinedDate: string;
    rating: number;
    reviews: number;
    reviewsList?: Review[];
    services?: Service[];
}

export default function ProviderProfile() {
    // All hooks MUST be at the top before any conditional logic
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { providers, addReview, createBooking, isInitialized, currentUser, loginUser, submitProviderRequest, refreshProviders, bookings } = useAppStore();
    const { addToInfoCart, pendingCartItems, submitInfoCart, addToGlobalCart, globalCart } = useCartStore();
    const { toast } = useToast();
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'services' | 'reviews'>('services');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [targetOrder, setTargetOrder] = useState<any>(null);
    const [providerDetails, setProviderDetails] = useState<Provider | null>(null);
    // Maintenance booking modal state - MOVED UP TO FIX HOOK ORDER
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
    const [selectedMaintenanceService, setSelectedMaintenanceService] = useState<string | undefined>(undefined);

    // Doctor booking modal state
    const [doctorModalOpen, setDoctorModalOpen] = useState(false);
    const [selectedDoctorService, setSelectedDoctorService] = useState<string | undefined>(undefined);

    // Playground booking modal state
    const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false);
    const [selectedPlaygroundService, setSelectedPlaygroundService] = useState<string | undefined>(undefined);

    const addToOrderId = searchParams.get('addToOrderId');
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

    const providerFromStore = providers.find((p: Provider) => p.id === params.id);
    const provider = providerDetails || providerFromStore;

    const fetchProviderDetails = async (providerId: string) => {
        try {
            const data = await apiCall(`/providers/${providerId}`);
            if (data) {
                setProviderDetails(data as Provider);
            }
        } catch (error) {
            console.warn('[ProviderProfile] Failed to fetch provider details:', error);
        }
    };

    useEffect(() => {
        if (!isInitialized || !params?.id) return;

        const id = String(params.id);
        fetchProviderDetails(id);

        // Keep customer page synced with server-side menu updates.
        // Poll every 30s (only while tab is visible) to reduce backend load.
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            fetchProviderDetails(id);
        }, 30000);
        return () => clearInterval(interval);
    }, [isInitialized, params?.id]);

    // Auto-refresh providers if not found (retry mechanism)
    useEffect(() => {
        if (isInitialized && !providerFromStore) {
            refreshProviders();
        }
    }, [isInitialized, params.id, providerFromStore, refreshProviders]);

    // Fetch target order if addToOrderId exists
    useEffect(() => {
        const fetchTargetOrder = async () => {
            if (addToOrderId) {
                const found = bookings.find(b => String(b.id) === String(addToOrderId));
                if (found) {
                    setTargetOrder(found);
                } else {
                    // Try to fetch from API if not in state
                    try {
                        const { bookingsApi, apiCall } = await import('@/lib/api');
                        let data;
                        try {
                            data = await bookingsApi.getById(addToOrderId);
                        } catch (e) {
                            console.warn("Failed to fetch target order via bookings API, trying halan tracking...", e);
                            const res = await apiCall(`/halan/orders/track/${addToOrderId}`);
                            if (res && res.order) {
                                data = res.order;
                            }
                        }
                        if (data) setTargetOrder(data);
                    } catch (e) {
                        console.error("Failed to fetch target order", e);
                    }
                }
            }
        };
        fetchTargetOrder();
    }, [addToOrderId, bookings]);

    // Now conditional logic AFTER all hooks
    if (!isInitialized) return null;



    if (!provider) {
        return (
            <div className="min-h-screen flex items-center justify-center p-10 flex-col gap-4">
                <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500">جاري تحميل بيانات مقدم الخدمة...</p>
                {/* Fallback if it takes too long */}
                <button onClick={() => window.location.reload()} className="text-violet-600 underline text-sm">
                    إعادة تحميل الصفحة
                </button>
            </div>
        );
    }

    // Render pharmacy-specific layout for medical/pharmacy/car service providers
    if (isPharmacyProvider(provider.category) || isCarServiceProvider(provider.category)) {
        return (
            <PharmacyProviderLayout
                provider={{
                    id: provider.id,
                    name: provider.name,
                    category: provider.category,
                    description: '',
                    phone: provider.phone,
                    address: provider.location,
                    rating: provider.rating,
                    review_count: provider.reviews,
                    image_url: (provider as any).image_url || (provider as any).image,
                    is_open: true,
                    services: provider.services?.map(s => ({
                        id: Number(s.id),
                        name: s.name,
                        description: s.description,
                        price: s.price,
                        image_url: s.image,
                        is_offer: !!s.offer,
                        offer_percentage: s.offer?.discountPercent,
                    })) || [],
                }}
            />
        );
    }

    // Dynamic Rating Calculation - Trust backend rating
    const reviewCount = provider.reviews || 0;
    const dynamicRating = Number(provider.rating) > 0 ? Number(provider.rating).toFixed(1) : "0.0";

    const handleSubmitReview = () => {
        if (!reviewForm.comment) return;
        setIsSubmitting(true);

        addReview(provider.id, reviewForm.rating, reviewForm.comment);

        setTimeout(() => {
            setReviewForm({ rating: 5, comment: "" });
            setIsSubmitting(false);
        }, 500);
    };

    const handleOrder = async (service: Service) => {
        if (addToOrderId) {
            // VALIDATION: Check if provider matches
            if (targetOrder) {
                if (targetOrder.is_parent && targetOrder.sub_orders) {
                    const hasSubOrder = targetOrder.sub_orders.some((s: any) => String(s.provider_id) === String(provider.id));
                    if (!hasSubOrder) {
                        toast("عفواً، هذا المتجر ليس جزءاً من طلبك المجمع. يرجى إنشاء طلب جديد.", "error");
                        return;
                    }
                } else if (targetOrder.providerId && String(targetOrder.providerId) !== String(provider.id)) {
                    toast("عفواً، لا يمكن إضافة منتجات من متجر مختلف لنفس الطلب. يجب إنشاء طلب جديد.", "error");
                    return;
                }
            } else {
                // Wait for order to load or warn
                console.warn("Target order not loaded yet");
                // Optional: prevent adding if critical, but if it's just slow, maybe let it slide? 
                // Better to be safe:
                // toast("جاري تحميل بيانات الطلب، يرجى الانتظار...", "info");
                // return;
            }

            // Add to local cart state for existing order update
            addToInfoCart(addToOrderId, {
                id: service.id,
                name: service.name,
                price: service.price,
                quantity: 1
            });
            return;
        }

        // Add to global cart for new orders
        addToGlobalCart({
            id: service.id,
            name: service.name,
            price: service.price,
            quantity: 1,
            providerId: provider.id,
            providerName: provider.name,
            image: service.image
        });
    };

    // Calculate cart total for current order (modification mode)
    const currentOrderCart = addToOrderId ? (pendingCartItems[addToOrderId] || []) : [];
    const cartTotal = currentOrderCart.reduce((acc, item) => acc + item.price, 0);

    const handleConfirmCart = async () => {
        if (!addToOrderId) return;
        setIsSubmitting(true);
        const success = await submitInfoCart(addToOrderId, provider.id);
        setIsSubmitting(false);
        if (success) {
            router.push(`/track/${addToOrderId}`);
        }
    };

    const isRestaurant = provider.category?.includes('مطعم') || provider.category?.includes('كافيه');
    const isDoctor = provider.category?.includes('دكتور') || provider.category?.includes('ممرض');
    const isPlayground = provider.category?.includes('ملاعب') || provider.category?.includes('ملعب');
    const isMaintenance = isMaintenanceProvider(provider.category);
    const services = provider.services || [];



    // Calculate discounted price
    const getDiscountedPrice = (service: Service) => {
        if (service.offer?.type === 'discount' && service.offer.discountPercent) {
            return service.price * (1 - service.offer.discountPercent / 100);
        }
        return service.price;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 pb-24 md:pb-8 transition-colors duration-300">
            <div className="container mx-auto px-4 max-w-5xl">
                {/* Back to Order Banner */}
                {addToOrderId && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-4 bg-green-600/10 border border-green-600/20 rounded-2xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center text-green-600">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-green-700 dark:text-green-400">أنت الآن تضيف للطلب #{targetOrder?.display_id || targetOrder?.id || 'الحالي'}</p>
                                <p className="text-[10px] text-green-600/80 mt-1">اختر أي صنف من المنيو وسيتم إضافته لطلبك.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(`/track/${addToOrderId}`)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition"
                        >
                            تم التعديل؟ ارجع للطلب
                        </button>
                    </motion.div>
                )}

                {/* Header Section (Modern SaaS Redesign) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 relative"
                >
                    <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-900/80 backdrop-blur-xl">
                        {/* Abstract Cover Photo */}
                        <div className={`h-36 md:h-64 w-full relative overflow-hidden ${isRestaurant ? "bg-gradient-to-r from-orange-400 via-rose-500 to-amber-500" : "bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"}`}>
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-[50px] mix-blend-overlay" />
                            <div className="absolute top-10 left-10 w-32 h-32 bg-black/10 rounded-full blur-[30px] mix-blend-overlay" />
                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
                        </div>

                        <div className="px-6 md:px-10 pb-10 relative -mt-16 sm:-mt-20">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
                                {/* Logo Avatar */}
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-500 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                                    <div className="w-28 h-28 sm:w-36 sm:h-36 relative bg-white dark:bg-slate-950 rounded-full border-4 sm:border-[6px] border-white dark:border-slate-900 shadow-xl flex items-center justify-center overflow-hidden z-10 transition-transform hover:scale-105 duration-300">
                                        {(provider as any).image_url || (provider as any).image ? (
                                            <img
                                                src={(provider as any).image_url || (provider as any).image}
                                                alt={provider.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className={`w-full h-full rounded-full ${isRestaurant ? "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/60 dark:to-orange-900/40 text-orange-500" : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-900/40 text-blue-500"} flex items-center justify-center text-4xl sm:text-6xl font-black font-cairo`}>
                                                {provider.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    {/* Verified Badge */}
                                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 z-20 bg-blue-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm" title="مزود خدمة موثوق">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 11.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Title and Info */}
                                <div className="flex-1 space-y-3 md:pb-2">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-cairo">{provider.name}</h1>
                                            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 font-medium font-cairo flex items-center gap-2 mt-1">
                                                {provider.category}
                                            </p>
                                        </div>

                                        {/* Rating display */}
                                        <div className="flex flex-col items-start md:items-end">
                                            <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-xl border border-yellow-200 dark:border-yellow-700/50 shadow-sm">
                                                <Star className="w-5 h-5 fill-yellow-400 text-yellow-500" />
                                                <span className="font-bold text-lg text-yellow-700 dark:text-yellow-400 font-cairo tracking-wide">
                                                    {reviewCount > 0 ? dynamicRating : "جديد"}
                                                </span>
                                            </div>
                                            {reviewCount > 0 && (
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1 mt-1 font-cairo underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4 cursor-pointer" onClick={() => setActiveTab('reviews')}>
                                                    بناءً على {reviewCount} تقييم حقيقي
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Meta tags */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 font-cairo">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            {provider.location}
                                        </div>
                                        {provider.phone && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 font-cairo">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                                {provider.phone}
                                            </div>
                                        )}
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 text-sm font-bold text-emerald-700 dark:text-emerald-400 font-cairo">
                                            متاح الآن للصفقات
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100/80 dark:bg-slate-800/50 rounded-xl w-fit mb-6 border border-transparent dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`
                            relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2
                            ${activeTab === 'services'
                                ? "text-slate-900 dark:text-white shadow-sm bg-white dark:bg-slate-700"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                            }
                        `}
                    >
                        {isRestaurant ? <Utensils className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                        {isRestaurant ? "المنيو" : "الخدمات"}
                        {services.length > 0 && (
                            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                                {services.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`
                            relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2
                            ${activeTab === 'reviews'
                                ? "text-slate-900 dark:text-white shadow-sm bg-white dark:bg-slate-700"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                            }
                        `}
                    >
                        <MessageSquare className="w-4 h-4" />
                        التقييمات
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {/* Services Tab */}
                    {activeTab === 'services' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {services.length === 0 ? (
                                <Card className="text-center py-16 border-dashed">
                                    <div className="text-slate-400">
                                        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                        <p>لا توجد خدمات متاحة حالياً</p>
                                    </div>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {services.map((service) => (
                                        <motion.div
                                            key={service.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            whileHover={{ y: -4 }}
                                            className="group"
                                        >
                                            <Card className="overflow-hidden h-full flex flex-col shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                {/* Image */}
                                                <div className={`h-40 relative ${isRestaurant ? 'bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/40 dark:to-orange-900/20' : 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950/40 dark:to-blue-900/20'}`}>
                                                    {service.image ? (
                                                        <img
                                                            src={service.image}
                                                            alt={service.name}
                                                            className="w-full h-full object-contain object-center"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            {isRestaurant ? (
                                                                <Utensils className="w-12 h-12 text-orange-300" />
                                                            ) : (
                                                                <ShoppingBag className="w-12 h-12 text-blue-300" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Offer Badge */}
                                                    {service.offer && (
                                                        <div className="absolute top-2 left-2">
                                                            {service.offer.type === 'discount' && (
                                                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                                    <Tag className="w-3 h-3" />
                                                                    خصم {service.offer.discountPercent}%
                                                                </span>
                                                            )}
                                                            {service.offer.type === 'bundle' && (
                                                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                                                    اشتر {service.offer.bundleCount} واحصل على {service.offer.bundleFreeCount} مجاناً
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <CardContent className="p-4 flex-1 flex flex-col">
                                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{service.name}</h3>
                                                    {service.description && (
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{service.description}</p>
                                                    )}

                                                    <div className="mt-auto flex items-center justify-between">
                                                        <div>
                                                            {service.offer?.type === 'discount' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg font-bold text-green-600">
                                                                        {getDiscountedPrice(service).toFixed(0)} ج.م
                                                                    </span>
                                                                    <span className="text-sm text-slate-400 line-through">
                                                                        {service.price} ج.م
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-lg font-bold text-primary">
                                                                    {service.price} ج.م
                                                                </span>
                                                            )}
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                if (isMaintenance) {
                                                                    setSelectedMaintenanceService(service.name);
                                                                    setMaintenanceModalOpen(true);
                                                                } else if (isDoctor) {
                                                                    setSelectedDoctorService(service.name);
                                                                    setDoctorModalOpen(true);
                                                                } else if (isPlayground) {
                                                                    setSelectedPlaygroundService(service.name);
                                                                    setPlaygroundModalOpen(true);
                                                                } else {
                                                                    handleOrder(service);
                                                                }
                                                            }}
                                                            className={isMaintenance ? "bg-blue-600 hover:bg-blue-700" : isDoctor ? "bg-cyan-600 hover:bg-cyan-700" : isPlayground ? "bg-green-600 hover:bg-green-700" : isRestaurant ? "bg-orange-500 hover:bg-orange-600" : ""}
                                                        >
                                                            {isMaintenance || isDoctor || isPlayground ? "احجز موعد" : addToOrderId ? "إضافة للطلب" : "إضافة للسلة"}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === 'reviews' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8"
                        >
                            {/* Reviews List */}
                            <div className="md:col-span-2 space-y-4">
                                {provider.reviewsList && provider.reviewsList.length > 0 ? (
                                    provider.reviewsList.map((review: Review) => (
                                        <motion.div
                                            key={review.id}
                                            initial={{ opacity: 0 }}
                                            whileInView={{ opacity: 1 }}
                                            viewport={{ once: true }}
                                        >
                                            <Card className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                                <User className="h-4 w-4 text-slate-400" />
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-sm text-slate-900 dark:text-white">{review.userName}</div>
                                                                <div className="text-xs text-slate-400">{review.date}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={`h-3 w-3 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-700"}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm pr-10">
                                                        {review.comment}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-slate-400">لا توجد تقييمات بعد. كن أول من يقيم!</p>
                                    </div>
                                )}
                            </div>


                            {/* Add Review Sidebar */}
                            <div>
                                <Card className="sticky top-24 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <CardHeader>
                                        <CardTitle className="text-lg">قيم تجربتك</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">التقييم</label>
                                            <div className="flex gap-2 justify-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                                        className="transition-transform hover:scale-110"
                                                        title={`تقييم ${star} نجوم`}
                                                        aria-label={`تقييم ${star} نجوم`}
                                                    >
                                                        <Star
                                                            className={`h-6 w-6 ${star <= reviewForm.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 dark:text-slate-600"}`}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">رأيك يهمنا</label>
                                            <textarea
                                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                                                placeholder="احكِ لنا عن تجربتك مع مقدم الخدمة..."
                                                value={reviewForm.comment}
                                                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                            ></textarea>
                                        </div>

                                        <Button
                                            className="w-full h-12 rounded-xl font-bold font-cairo text-base"
                                            onClick={handleSubmitReview}
                                            disabled={!reviewForm.comment || isSubmitting}
                                        >
                                            {isSubmitting ? "جاري النشر..." : "نشر التقييم"}
                                        </Button>

                                        <p className="text-xs text-slate-400 text-center mt-2">
                                            اسمك سيظهر كـ "مستخدم مجهول" للحفاظ على الخصوصية.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Cart Bar for Adding Items */}
                <AnimatePresence>
                    {
                        addToOrderId && currentOrderCart.length > 0 && (
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 shadow-2xl"
                            >
                                <div className="container mx-auto max-w-5xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center relative">
                                            <ShoppingBag className="w-6 h-6" />
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
                                                {currentOrderCart.length}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">السلة المؤقتة</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                الإجمالي: <span className="font-bold text-indigo-600 dark:text-indigo-400">{cartTotal} ج.م</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => router.push(`/track/${addToOrderId}`)}
                                            className="hidden sm:flex"
                                        >
                                            إلغاء
                                        </Button>
                                        <Button
                                            onClick={handleConfirmCart}
                                            disabled={isSubmitting}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold px-6"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    جاري التأكيد...
                                                </>
                                            ) : (
                                                <>
                                                    تأكيد وإضافة للطلب
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {/* Global Cart Floating Button (Mobile) */}
                {!addToOrderId && globalCart.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsCartOpen(true)}
                        className="fixed bottom-24 md:bottom-6 left-6 z-[60] bg-violet-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center lg:hidden"
                    >
                        <div className="relative">
                            <ShoppingCart className="w-6 h-6" />
                            <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                                {globalCart.length}
                            </span>
                        </div>
                    </motion.button>
                )}

                <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

                {/* Maintenance Booking Modal */}
                {isMaintenance && (
                    <MaintenanceBookingModal
                        provider={{ id: provider.id, name: provider.name, category: provider.category }}
                        serviceName={selectedMaintenanceService}
                        open={maintenanceModalOpen}
                        onOpenChange={setMaintenanceModalOpen}
                    />
                )}

                {/* Doctor Booking Modal */}
                {isDoctor && (
                    <DoctorBookingModal
                        provider={provider}
                        serviceName={selectedDoctorService}
                        open={doctorModalOpen}
                        onOpenChange={setDoctorModalOpen}
                    />
                )}

                {/* Playground Booking Modal */}
                {isPlayground && (
                    <PlaygroundsBookingModal
                        provider={provider}
                        serviceName={selectedPlaygroundService}
                        open={playgroundModalOpen}
                        onOpenChange={setPlaygroundModalOpen}
                    />
                )}
            </div >
        </div >
    )
}
