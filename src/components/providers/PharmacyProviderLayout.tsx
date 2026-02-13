"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Star,
    MapPin,
    Phone,
    MessageSquare,
    ShoppingCart,
    Plus,
    Minus,
    ChevronLeft,
    Pill,
    Clock,
    Tag,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PharmacyChat } from "@/components/features/PharmacyChat";
import { CartModal } from "@/components/features/cart-modal";

// Type definitions
interface Service {
    id: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    is_offer?: boolean;
    offer_percentage?: number;
    stock?: number;
}

interface Provider {
    id: number;
    name: string;
    category: string;
    description?: string;
    phone?: string;
    address?: string;
    rating: number;
    review_count?: number;
    image_url?: string;
    is_open?: boolean;
    services?: Service[];
}

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
}

interface PharmacyProviderLayoutProps {
    provider: Provider;
}

export function PharmacyProviderLayout({ provider }: PharmacyProviderLayoutProps) {
    const router = useRouter();
    const { currentUser, globalCart, addToGlobalCart, removeFromGlobalCart, updateGlobalCartQuantity } = useAppStore();
    const { toast } = useToast();

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isPharmacistOnline, setIsPharmacistOnline] = useState(true); // Forced Online as requested
    const [searchQuery, setSearchQuery] = useState("");

    const providerIdStr = String(provider.id);

    // Filter services based on search
    const filteredServices = provider.services?.filter(
        (service) =>
            service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // Get cart items for this provider
    const providerCartItems = globalCart.filter((item) =>
        item.providerId === providerIdStr
    );

    const totalCartItems = providerCartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartPrice = providerCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discounted price
    const getPrice = (service: Service) => {
        if (service.is_offer && service.offer_percentage) {
            return service.price * (1 - service.offer_percentage / 100);
        }
        return service.price;
    };

    // Get item quantity in cart
    const getItemQuantity = (serviceId: number) => {
        const item = globalCart.find((i) => i.id === String(serviceId) && i.providerId === providerIdStr);
        return item?.quantity || 0;
    };

    // Handle add to cart
    const handleAddToCart = (service: Service) => {
        addToGlobalCart({
            id: String(service.id),
            name: service.name,
            price: getPrice(service),
            quantity: 1,
            image: service.image_url,
            providerId: providerIdStr,
            providerName: provider.name,
        });
        toast("تمت الإضافة للسلة", "success");
    };

    // Handle quantity change
    const handleQuantityChange = (service: Service, delta: number) => {
        const currentQty = getItemQuantity(service.id);
        const newQty = currentQty + delta;
        const serviceIdStr = String(service.id);

        if (newQty <= 0) {
            removeFromGlobalCart(providerIdStr, serviceIdStr);
        } else {
            updateGlobalCartQuantity(providerIdStr, serviceIdStr, newQty);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Hero Section with Provider Info */}
            <div className="relative h-48 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition z-10"
                    title="رجوع"
                    aria-label="الرجوع للصفحة السابقة"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Provider Image */}
                {provider.image_url && (
                    <img
                        src={provider.image_url}
                        alt={provider.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                )}

                {/* Provider Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="flex items-end gap-4">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center overflow-hidden">
                            {provider.image_url ? (
                                <img src={provider.image_url} alt={provider.name} className="w-full h-full object-cover" />
                            ) : (
                                <Pill className="w-10 h-10 text-emerald-600" />
                            )}
                        </div>
                        <div className="flex-1 text-white pb-1">
                            <h1 className="text-xl font-bold">{provider.name}</h1>
                            <div className="flex items-center gap-3 text-sm opacity-90">
                                <span className="flex items-center gap-1">
                                    <Star className={`w-4 h-4 ${Number(provider.rating) > 0 ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                                    {Number(provider.rating) > 0 ? Number(provider.rating).toFixed(1) : '0.0'}
                                </span>
                                {provider.address && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        {provider.address}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Call Button */}
                        {provider.phone && (
                            <a
                                href={`tel:${provider.phone}`}
                                className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition"
                                title="اتصال بالصيدلية"
                                aria-label={`اتصال بالصيدلية على الرقم ${provider.phone}`}
                            >
                                <Phone className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Section - Products */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="ابحث عن دواء أو منتج..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {filteredServices.length > 0 ? (
                                filteredServices.map((service) => {
                                    const itemQty = getItemQuantity(service.id);
                                    const discountedPrice = getPrice(service);

                                    return (
                                        <motion.div
                                            key={service.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group"
                                        >
                                            <Card className="overflow-hidden hover:shadow-lg transition-shadow border-0 bg-white dark:bg-slate-900">
                                                <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                                                    {service.image_url ? (
                                                        <img
                                                            src={service.image_url}
                                                            alt={service.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Pill className="w-12 h-12 text-slate-300" />
                                                        </div>
                                                    )}

                                                    {/* Offer Badge */}
                                                    {service.is_offer && service.offer_percentage && (
                                                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                                            <Tag className="w-3 h-3" />
                                                            -{service.offer_percentage}%
                                                        </div>
                                                    )}
                                                </div>

                                                <CardContent className="p-3">
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mb-1">
                                                        {service.name}
                                                    </h3>

                                                    {/* Prices */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="font-bold text-emerald-600">
                                                            {discountedPrice.toFixed(0)} ج.م
                                                        </span>
                                                        {service.is_offer && (
                                                            <span className="text-xs text-slate-400 line-through">
                                                                {service.price.toFixed(0)} ج.م
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Add to Cart Controls */}
                                                    {itemQty === 0 ? (
                                                        <Button
                                                            size="sm"
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                            onClick={() => handleAddToCart(service)}
                                                        >
                                                            <Plus className="w-4 h-4 ml-1" />
                                                            أضف للسلة
                                                        </Button>
                                                    ) : (
                                                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-1">
                                                            <button
                                                                onClick={() => handleQuantityChange(service, -1)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                                                                title="تقليل الكمية"
                                                                aria-label={`تقليل كمية ${service.name}`}
                                                            >
                                                                <Minus className="w-4 h-4" />
                                                            </button>
                                                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                                {itemQty}
                                                            </span>
                                                            <button
                                                                onClick={() => handleQuantityChange(service, 1)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-slate-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition"
                                                                title="زيادة الكمية"
                                                                aria-label={`زيادة كمية ${service.name}`}
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-12 text-center text-slate-500">
                                    <Pill className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>لا توجد منتجات متاحة</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Section - Contact Hub */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-4 space-y-4">
                            {/* Contact Pharmacy Card */}
                            <Card className="overflow-hidden border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                                <CardContent className="p-6 text-center">
                                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                                        <MessageSquare className="w-10 h-10 text-white" />
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                        تواصل مع الصيدلية
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                        أرسل صورة الروشتة أو استفسر عن الأدوية
                                    </p>

                                    {/* Online Status */}
                                    <div className="flex items-center justify-center gap-2 mb-4 text-sm">
                                        <span className={`w-3 h-3 rounded-full ${isPharmacistOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                        <span className={isPharmacistOnline ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500'}>
                                            {isPharmacistOnline ? 'الصيدلي متصل الآن' : 'الصيدلي غير متصل'}
                                        </span>
                                    </div>

                                    <Button
                                        size="lg"
                                        className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                                        onClick={() => setIsChatOpen(true)}
                                    >
                                        <MessageSquare className="w-5 h-5 ml-2" />
                                        ابدأ المحادثة
                                    </Button>

                                    {/* Features */}
                                    <div className="mt-6 space-y-2 text-right">
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <Sparkles className="w-4 h-4 text-emerald-500" />
                                            <span>إرسال صور الروشتات</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                            <Clock className="w-4 h-4 text-emerald-500" />
                                            <span>رد سريع من الصيدلي</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Cart Summary */}
                            {totalCartItems > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <Card className="overflow-hidden border-0 bg-white dark:bg-slate-900 shadow-lg">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="font-bold text-slate-900 dark:text-white">سلة المشتريات</span>
                                                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold px-2 py-1 rounded-full">
                                                    {totalCartItems} منتج
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-slate-500">الإجمالي</span>
                                                <span className="text-xl font-bold text-emerald-600">
                                                    {totalCartPrice.toFixed(0)} ج.م
                                                </span>
                                            </div>
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => setIsCartOpen(true)}
                                            >
                                                <ShoppingCart className="w-5 h-5 ml-2" />
                                                عرض السلة
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Cart Button (Mobile) */}
            {totalCartItems > 0 && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="fixed bottom-6 left-6 lg:hidden bg-gradient-to-l from-emerald-600 to-teal-600 text-white p-4 rounded-full shadow-2xl z-40"
                    onClick={() => setIsCartOpen(true)}
                >
                    <ShoppingCart className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {totalCartItems}
                    </span>
                </motion.button>
            )}

            {/* Chat Modal */}
            <AnimatePresence>
                {isChatOpen && (
                    <PharmacyChat
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        providerId={String(provider.id)}
                        providerName={provider.name}
                    />
                )}
            </AnimatePresence>

            {/* Cart Modal */}
            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />
        </div>
    );
}
