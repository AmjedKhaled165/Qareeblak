"use client";

import { ServiceCard } from "@/components/features/service-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Utensils, Wrench, Pill, Car, ShoppingBag, ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { useAppStore } from "@/components/providers/AppProvider";
import { CartModal } from "@/components/features/cart-modal";

import { SkeletonCard } from "@/components/features/skeleton-card";
import { useMemo } from "react";

import { useDebounce } from "@/hooks/use-debounce";

const CATEGORIES = [
    { id: "all", label: "الكل", icon: null },
    { id: "مطاعم", label: "مطاعم وكافيهات", icon: Utensils },
    { id: "صيانة", label: "صيانة وسباكة", icon: Wrench },
    { id: "طبي", label: "طبي وصيدليات", icon: Pill },
    { id: "سيارات", label: "خدمات سيارات", icon: Car },
    { id: "بقالة", label: "سوبر ماركت", icon: ShoppingBag },
];

export default function ExplorePage() {
    const { providers, isInitialized, isLoading, currentUser, globalCart } = useAppStore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const addToOrderId = searchParams.get('addToOrderId');
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(12);

    // Debounce the search term to prevent lag
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        if (currentUser?.type === 'provider') {
            router.replace('/provider-dashboard');
        }
    }, [currentUser, router]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(12);
    }, [activeCategory, debouncedSearchQuery]);

    if (!isInitialized || currentUser?.type === 'provider') return null; // Avoid hydration mismatch or provider flash

    const filteredProviders = useMemo(() => {
        return providers.filter(provider => {
            const matchesCategory = activeCategory === "all" || provider.category === activeCategory;
            const matchesSearch = provider.name.includes(debouncedSearchQuery) ||
                provider.location.includes(debouncedSearchQuery) ||
                (provider.services && provider.services.some(s => s.name.includes(debouncedSearchQuery)));
            return matchesCategory && matchesSearch;
        });
    }, [providers, activeCategory, debouncedSearchQuery]);

    const displayedProviders = filteredProviders.slice(0, visibleCount);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 12);
    };

    return (
        <div className="min-h-screen bg-background py-8">
            {/* Add Item Banner */}
            {addToOrderId && (
                <div className="bg-green-600 text-white p-4 sticky top-0 z-[60] shadow-lg flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold">أنت الآن تضيف منتجات للطلب #{addToOrderId}</p>
                            <p className="text-sm opacity-90">تصفح المحلات والخدمات واختر ما تحتاجه</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push(`/track/${addToOrderId}`)}
                        className="px-4 py-2 bg-white text-green-700 rounded-lg font-bold text-sm hover:bg-green-50 transition"
                    >
                        العودة للطلب
                    </button>
                </div>
            )}
            <div className="container mx-auto px-4">
                {/* Header & Filter */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-foreground">تصفح الخدمات</h1>
                        <p className="text-muted-foreground">أكثر من 50 خدمة متاحة في أسيوط الجديدة</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث عن خدمة..."
                                className="pr-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon">
                            <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Categories Tabs */}
                <div className="flex overflow-x-auto pb-4 gap-2 mb-8 no-scrollbar scroll-smooth">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-bold border",
                                activeCategory === cat.id
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 hover:bg-primary/90"
                                    : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                            )}
                        >
                            {cat.icon && <cat.icon className="h-4 w-4" />}
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={`skeleton-${i}`} />
                        ))
                    ) : displayedProviders.length > 0 ? (
                        displayedProviders.map((provider) => (
                            <ServiceCard key={provider.id} provider={provider} addToOrderId={addToOrderId} />
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="col-span-full flex flex-col items-center justify-center py-20 text-center"
                        >
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                                <Search className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">لا توجد نتائج</h3>
                            <p className="text-muted-foreground mb-4">لم نجد أي خدمات تطابق بحثك في هذا القسم.</p>
                            <Button variant="outline" className="border-border hover:bg-accent" onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}>عرض كل الخدمات</Button>
                        </motion.div>
                    )}
                </motion.div>

                {/* Load More */}
                {!isLoading && visibleCount < filteredProviders.length && (
                    <div className="mt-12 text-center">
                        <Button onClick={handleLoadMore} variant="outline" className="px-8 py-6 rounded-full font-bold shadow-sm hover:shadow-md transition-shadow">عرض المزيد</Button>
                    </div>
                )}
            </div>

            {/* Floating Cart Button for Mobile */}
            <AnimatePresence>
                {globalCart.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0, opacity: 0, y: 20 }}
                        onClick={() => setIsCartOpen(true)}
                        className="fixed bottom-6 left-6 z-50 bg-primary text-white p-4 rounded-full shadow-2xl flex items-center gap-2 group hover:scale-110 transition-transform md:hidden"
                    >
                        <div className="relative">
                            <ShoppingCart className="w-6 h-6" />
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                                {globalCart.length}
                            </span>
                        </div>
                        <span className="font-bold text-sm">عرض السلة</span>
                    </motion.button>
                )}
            </AnimatePresence>

            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />
        </div>
    )
}
