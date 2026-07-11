"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Utensils, Wrench, Pill, Car, ShoppingBag, ShoppingCart, Star, Stethoscope } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useAppStore } from "@/components/providers/AppProvider";
import { useCartStore } from "@/components/providers/CartProvider";

import { SkeletonCard } from "@/components/features/skeleton-card";
import { useMemo } from "react";

import { useDebounce } from "@/hooks/use-debounce";
import { isPharmacyProvider, isDoctorProvider, isMaintenanceProvider, isCarServiceProvider, isPlaygroundProvider, isRestaurantProvider } from "@/lib/category-utils";

const ServiceCard = dynamic(
    () => import("@/components/features/service-card").then((m) => m.ServiceCard),
    { loading: () => <SkeletonCard /> }
);

const CartModal = dynamic(
    () => import("@/components/features/cart-modal").then((m) => m.CartModal),
    { ssr: false }
);

const CATEGORIES = [
    { id: "all", label: "الكل", icon: null },
    { id: "مطاعم", label: "مطاعم وكافيهات", icon: Utensils },
    { id: "صيانة", label: "صيانة وسباكة", icon: Wrench },
    { id: "صيدليات", label: "صيدليات", icon: Pill },
    { id: "دكتور وممرض", label: "دكتور وممرض", icon: Stethoscope },
    { id: "ملاعب", label: "ملاعب", icon: Star },
    { id: "سيارات", label: "خدمات سيارات", icon: Car },
    { id: "بقالة", label: "سوبر ماركت", icon: ShoppingBag },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    "مطاعم": ["مطعم", "كافيه", "اكل", "بيتزا", "برجر", "قهوة", "مقهى", "مشويات", "طعام", "كريب", "شاورما"],
    "صيانة": ["صيانة", "سباك", "سباكة", "كهرباء", "كهربائي", "نجار", "نقاش", "تكييف", "تصليح", "دهانات", "دش"],
    "صيدليات": ["صيدلية", "علاج", "دواء", "روشتة"],
    "دكتور وممرض": ["طبيب", "دكتور", "ممرض", "ممرضة", "مستشفى", "عيادة", "تحاليل", "اشعة", "اسنان", "علاج طبيعي"],
    "ملاعب": ["ملعب", "ملاعب", "كورة", "كرة", "قدم", "رياضة", "حجز", "خماسي", "مباراة"],
    "سيارات": ["سيارة", "عربية", "كاوتش", "ميكانيكي", "غسيل", "ونش", "بطارية", "عفشة"],
    "بقالة": ["سوبر ماركت", "بقالة", "خضار", "فاكهة", "لحوم", "فراخ", "جزاره", "عطارة", "مخبز", "تسوق"],
};

const normalizeText = (text: string) => {
    if (!text) return "";
    return text.toString()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase();
};

function inferCategoryFromQuery(query: string): string | null {
    if (!query) return null;
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
    
    for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            const normalizedKeyword = normalizeText(keyword);
            for (const word of queryWords) {
                const broadWord = word.startsWith('ال') && word.length > 3 ? word.substring(2) : word;
                if (broadWord === normalizedKeyword || normalizedKeyword.includes(broadWord) || broadWord.includes(normalizedKeyword)) {
                    return catId;
                }
            }
        }
    }
    return null;
}

function ExploreContent() {
    const { providers, isInitialized, isLoading, currentUser } = useAppStore();
    const { globalCart } = useCartStore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const addToOrderId = searchParams.get('addToOrderId');
    const categoryFromUrl = searchParams.get('category');
    const queryFromHome = searchParams.get('q') || "";

    // Determine initial active category based on URL or inference
    const initialCategory = useMemo(() => {
        if (categoryFromUrl) {
            const matched = CATEGORIES.find(c => c.label === categoryFromUrl || c.id === categoryFromUrl);
            if (matched) return matched.id;
        }
        if (queryFromHome) {
            const inferred = inferCategoryFromQuery(queryFromHome);
            if (inferred) return inferred;
        }
        return "all";
    }, [categoryFromUrl, queryFromHome]);

    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(12);
    const [sortBy, setSortBy] = useState<"default" | "top-rated" | "most-ordered" | "most-offers">("default");

    // Debounce the search term to prevent lag
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Ensure we start on the right category if arriving from another link
    useEffect(() => {
        if (initialCategory !== "all") {
            setActiveCategory(initialCategory);
        }
    }, [initialCategory]);

    // User specifically requested NOT to auto-switch categories when typing in search
    // to allow searching for a name or service globally.
    /*
    useEffect(() => {
        if (debouncedSearchQuery) {
            const inferred = inferCategoryFromQuery(debouncedSearchQuery);
            if (inferred && inferred !== activeCategory) {
                setActiveCategory(inferred);
            }
        }
    }, [debouncedSearchQuery]); // purposely excluding activeCategory to avoid looping
    */

    const normalizedProviders = useMemo(() => {
        return (providers || []).map((provider) => {
            const providerName = typeof provider?.name === 'string' ? provider.name : '';
            const providerLocation = typeof provider?.location === 'string' ? provider.location : '';
            const providerServices = Array.isArray(provider?.services) ? provider.services : [];
            const servicesText = providerServices
                .map((s) => (typeof s?.name === 'string' ? s.name : ''))
                .join(' ');

            const _providerCategory = typeof provider?.category === 'string' ? provider.category : '';
            
            // Map the raw category from the backend to the frontend CATEGORIES ID using robust utilities
            let catId = "all";
            if (isPharmacyProvider(_providerCategory)) catId = "صيدليات";
            else if (isDoctorProvider(_providerCategory)) catId = "دكتور وممرض";
            else if (isMaintenanceProvider(_providerCategory)) catId = "صيانة";
            else if (isCarServiceProvider(_providerCategory)) catId = "سيارات";
            else if (isPlaygroundProvider(_providerCategory)) catId = "ملاعب";
            else if (_providerCategory.includes('بقالة') || _providerCategory.includes('سوبر') || _providerCategory.includes('ماركت') || _providerCategory.includes('خضار') || _providerCategory.includes('لحوم') || _providerCategory.includes('مقاضي')) {
                catId = "بقالة";
            }
            else if (isRestaurantProvider(_providerCategory)) {
                catId = "مطاعم";
            } else {
                // Fallback: match by label or exact id
                const categoryObj = CATEGORIES.find(c => c.id === _providerCategory || c.label === _providerCategory);
                catId = categoryObj?.id || _providerCategory;
            }

            const categoryObj = CATEGORIES.find(c => c.id === catId);
            const catLabel = categoryObj?.label || '';
            const catKeywords = CATEGORY_KEYWORDS[catId]?.join(' ') || '';

            return {
                ...provider,
                _providerCategory,
                _mappedCategoryId: catId,
                _searchIndex: normalizeText(`${providerName} ${providerLocation} ${servicesText} ${_providerCategory} ${catLabel} ${catKeywords}`),
            };
        });
    }, [providers]);

    const filteredProviders = useMemo(() => {
        const normalizedQuery = normalizeText(debouncedSearchQuery.trim());
        const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

        let result = normalizedProviders.filter(provider => {
            const matchesCategory = activeCategory === "all" || provider._mappedCategoryId === activeCategory;
            
            const matchesSearch = queryWords.length === 0 || queryWords.every(word => {
                const broadWord = word.startsWith('ال') && word.length > 3 ? word.substring(2) : word;
                return provider._searchIndex.includes(word) || provider._searchIndex.includes(broadWord);
            });

            return matchesCategory && matchesSearch;
        });

        if (sortBy === "top-rated") {
            result = result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        } else if (sortBy === "most-ordered") {
            result = result.sort((a, b) => Number((b as any).orders_count || 0) - Number((a as any).orders_count || 0));
        } else if (sortBy === "most-offers") {
            result = result.sort((a, b) => Number((b as any).offers_count || 0) - Number((a as any).offers_count || 0));
        }

        return result;
    }, [normalizedProviders, activeCategory, debouncedSearchQuery, sortBy]);

    useEffect(() => {
        if (currentUser?.type === 'provider') {
            router.prefetch('/provider-dashboard');
            router.replace('/provider-dashboard');
        }
    }, [currentUser, router]);

    useEffect(() => {
        if (queryFromHome) {
            setSearchQuery(queryFromHome);
        }
    }, [queryFromHome]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(12);
    }, [activeCategory, debouncedSearchQuery, sortBy]);

    const displayedProviders = useMemo(
        () => filteredProviders.slice(0, visibleCount),
        [filteredProviders, visibleCount]
    );

    if (!isInitialized || currentUser?.type === 'provider') return null;

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 12);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 pb-24 md:pb-8 font-cairo">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20 dark:to-transparent pointer-events-none -z-10" />
            
            {/* Add Item Banner */}
            {addToOrderId && (
                <div className="bg-emerald-600 text-white p-4 sticky top-0 z-[60] shadow-lg flex items-center justify-between mb-8 mx-4 rounded-2xl border border-emerald-500">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">إضافة للطلب #{addToOrderId}</p>
                            <p className="text-sm opacity-90 mt-0.5">تصفح الخدمات واختر ما تحتاجه</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push(`/track/${addToOrderId}`)}
                        className="px-5 py-2.5 bg-white text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors shadow-sm"
                    >
                        العودة للطلب
                    </button>
                </div>
            )}
            <div className="container max-w-7xl mx-auto px-4 lg:px-8">
                {/* Header & Filter */}
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-center lg:items-end mb-10 text-center lg:text-right">
                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">تصفح الخدمات</h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">أكثر من 50 خدمة ومطعم متاحين في أسيوط الجديدة</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 sm:w-80 md:w-96 group">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                placeholder="ابحث عن سباك، بيتزا، طوارئ..."
                                className="pr-12 h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-base font-medium focus-visible:ring-indigo-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="relative h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center px-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer min-w-[140px]">
                                <select 
                                    value={sortBy} 
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="w-full h-full bg-transparent outline-none appearance-none pl-6 pr-2 font-bold text-slate-700 dark:text-slate-300 text-sm cursor-pointer"
                                >
                                    <option value="default" className="text-slate-900">الترتيب الافتراضي</option>
                                    <option value="top-rated" className="text-slate-900">الأعلى تقييم</option>
                                    <option value="most-ordered" className="text-slate-900">الأكثر طلباً</option>
                                    <option value="most-offers" className="text-slate-900">الأكثر عروضاً</option>
                                </select>
                                <div className="absolute left-3 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                            <Button
                                className="h-14 w-14 shrink-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-indigo-600 pop-hover"
                                variant="outline"
                                onClick={() => {
                                    setActiveCategory('all');
                                    setSearchQuery('');
                                    setSortBy('default');
                                }}
                                title="إعادة ضبط البحث"
                            >
                                <SlidersHorizontal className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Categories Tabs */}
                <div className="flex overflow-x-auto pb-4 gap-2 mb-8 no-scrollbar scroll-smooth">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-bold border pop-hover",
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
                        <Button onClick={handleLoadMore} variant="outline" className="px-8 py-6 rounded-full font-bold shadow-sm hover:shadow-md transition-shadow btn-3d">عرض المزيد</Button>
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
                        className="fixed bottom-24 md:bottom-6 left-6 z-50 bg-primary text-white p-4 rounded-full shadow-2xl flex items-center gap-2 group hover:scale-110 transition-transform md:hidden"
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
    );
}

export default function ExplorePage() {
    return (
        <Suspense fallback={<div className="container mx-auto p-8"><div className="h-10 w-48 bg-slate-200 animate-pulse rounded mb-8" /></div>}>
            <ExploreContent />
        </Suspense>
    );
}
