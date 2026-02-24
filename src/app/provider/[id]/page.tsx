"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, MapPin, Phone, User, Calendar, MessageSquare, ShoppingBag, Utensils, Tag, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CartModal } from "@/components/features/cart-modal";
import { isPharmacyProvider, isMaintenanceProvider } from "@/lib/category-utils";
import { PharmacyProviderLayout } from "@/components/providers/PharmacyProviderLayout";
import { MaintenanceBookingModal } from "@/components/features/maintenance-booking-modal";

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
    const { providers, addReview, createBooking, isInitialized, currentUser, loginUser, submitProviderRequest, refreshProviders, bookings, addToInfoCart, pendingCartItems, submitInfoCart, addToGlobalCart, globalCart } = useAppStore();
    const { toast } = useToast();
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'services' | 'reviews'>('services');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [targetOrder, setTargetOrder] = useState<any>(null);
    // Maintenance booking modal state - MOVED UP TO FIX HOOK ORDER
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
    const [selectedMaintenanceService, setSelectedMaintenanceService] = useState<string | undefined>(undefined);

    const addToOrderId = searchParams.get('addToOrderId');
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

    const provider = providers.find((p: Provider) => p.id === params.id);

    // Auto-refresh providers if not found (retry mechanism)
    useEffect(() => {
        if (isInitialized && !provider) {
            refreshProviders();
        }
    }, [isInitialized, params.id, provider, refreshProviders]);

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
                        // Import API dynamically to avoid circular deps if any
                        const { bookingsApi } = await import('@/lib/api');
                        const data = await bookingsApi.getById(addToOrderId);
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

    // Debugging logs
    console.log("Provider Param ID:", params.id);
    console.log("Total Providers:", providers.length);
    if (providers.length > 0) {
        console.log("First Provider ID:", providers[0].id, "Type:", typeof providers[0].id);
    }
    console.log("Found Provider:", provider);

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

    // Render pharmacy-specific layout for medical/pharmacy providers
    if (isPharmacyProvider(provider.category)) {
        return (
            <PharmacyProviderLayout
                provider={{
                    id: Number(provider.id),
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
            toast(`تم إضافة "${service.name}" للسلة!`, "success");
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

        toast(`تم إضافة "${service.name}" لسلة المشتريات`, "success");
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
            toast("تم تحديث الطلب بنجاح!", "success");
            router.push(`/track/${addToOrderId}`);
        } else {
            toast("حدث خطأ في تحديث الطلب", "error");
        }
    };

    const isRestaurant = provider.category.includes("مطعم") || provider.category.includes("مطاعم");
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 transition-colors duration-300">
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
                                <p className="font-bold text-green-700 dark:text-green-400">أنت الآن تضيف للطلب #{addToOrderId}</p>
                                <p className="text-xs text-green-600/80">اختر أي صنف من المنيو وسيتم إضافته لطلبك الحالي.</p>
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

                {/* Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Card className="border-none shadow-lg overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800">
                        <div className={`h-32 ${isRestaurant ? "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-950/40 dark:to-orange-900/20" : "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-950/40 dark:to-blue-900/20"} relative`}>
                            <div className="absolute -bottom-10 right-8 w-24 h-24 bg-white dark:bg-slate-800 rounded-full p-1 shadow-md flex items-center justify-center">
                                <div className={`w-full h-full rounded-full ${isRestaurant ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"} flex items-center justify-center text-3xl font-bold`}>
                                    {provider.name.charAt(0)}
                                </div>
                            </div>
                        </div>
                        <CardContent className="pt-12 pb-6 px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{provider.name}</h1>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {provider.location}
                                    </div>
                                    {provider.phone && (
                                        <div className="flex items-center gap-1">
                                            <Phone className="h-4 w-4" />
                                            {provider.phone}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        انضم: {new Date(provider.joinedDate).toLocaleDateString('ar-EG')}
                                    </div>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 ${reviewCount > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'} px-4 py-2 rounded-xl border`}>
                                <Star className={`h-6 w-6 ${reviewCount > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600'}`} />
                                <div>
                                    <div className="font-bold text-lg text-slate-800 dark:text-slate-200">{reviewCount > 0 ? dynamicRating : 0}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{reviewCount} تقييم</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
                                                            className="w-full h-full object-cover"
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
                                                                } else {
                                                                    handleOrder(service);
                                                                }
                                                            }}
                                                            className={isMaintenance ? "bg-blue-600 hover:bg-blue-700" : isRestaurant ? "bg-orange-500 hover:bg-orange-600" : ""}
                                                        >
                                                            {isMaintenance ? "احجز موعد" : addToOrderId ? "إضافة للطلب" : "إضافة للسلة"}
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
                                            className="w-full"
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
                        className="fixed bottom-6 left-6 z-[60] bg-violet-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center lg:hidden"
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
            </div >
        </div >
    )
}
