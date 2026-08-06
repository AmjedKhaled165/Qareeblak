"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, SlidersHorizontal, Utensils, Pill, Car, 
    ShoppingBag, ShoppingCart, Star, Stethoscope, 
    Sparkles, Zap, Flame, ShieldCheck, RotateCcw, X, Grid, List, Clock
} from "lucide-react";
import { useState, useEffect, Suspense, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useAppStore } from "@/components/providers/AppProvider";
import { useCartStore } from "@/components/providers/CartProvider";
import { SkeletonCard } from "@/components/features/skeleton-card";
import { useDebounce } from "@/hooks/use-debounce";
import { 
    isPharmacyProvider, isDoctorProvider, isMaintenanceProvider, 
    isCarServiceProvider, isPlaygroundProvider, isRestaurantProvider, isCraftsmanProvider 
} from "@/lib/category-utils";

const ServiceCard = dynamic(
    () => import("@/components/features/service-card").then((m) => m.ServiceCard),
    { loading: () => <SkeletonCard /> }
);

const CartModal = dynamic(
    () => import("@/components/features/cart-modal").then((m) => m.CartModal),
    { ssr: false }
);

const CATEGORIES = [
    { id: "all", label: "جميع الخدمات", icon: Sparkles, color: "from-indigo-500 to-purple-600", bgLight: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
    { id: "مطاعم", label: "مطاعم وكافيهات", icon: Utensils, color: "from-orange-500 to-amber-600", bgLight: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
    { id: "صيدليات", label: "صيدليات وطوارئ", icon: Pill, color: "from-emerald-500 to-teal-600", bgLight: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { id: "دكتور وممرض", label: "دكتور وممرض", icon: Stethoscope, color: "from-rose-500 to-pink-600", bgLight: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { id: "ملاعب", label: "حجز ملاعب", icon: Star, color: "from-violet-500 to-purple-600", bgLight: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { id: "سيارات", label: "خدمات سيارات", icon: Car, color: "from-sky-500 to-blue-600", bgLight: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { id: "بقالة", label: "سوبر ماركت", icon: ShoppingBag, color: "from-green-500 to-emerald-600", bgLight: "bg-green-500/10 text-green-600 dark:text-green-400" },
];

const QUICK_TAGS = [
    { label: "سباكة 🔧", query: "سباك" },
    { label: "مشويات 🍖", query: "مشويات" },
    { label: "بيتزا 🍕", query: "بيتزا" },
    { label: "صيدلية 💊", query: "صيدلية" },
    { label: "تكييف ❄️", query: "تكييف" },
    { label: "طوارئ 🚨", query: "طوارئ" },
    { label: "ملعب خماسي ⚽", query: "ملعب" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    "مطاعم": ["مطعم", "كافيه", "اكل", "بيتزا", "برجر", "قهوة", "مقهى", "مشويات", "طعام", "كريب", "شاورما"],
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
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    
    const addToOrderId = searchParams.get('addToOrderId');
    const categoryFromUrl = searchParams.get('category');
    const queryFromHome = searchParams.get('q') || "";

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

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        if (initialCategory !== "all") {
            setActiveCategory(initialCategory);
        }
    }, [initialCategory]);

    const normalizedProviders = useMemo(() => {
        return (providers || []).map((provider) => {
            const providerName = typeof provider?.name === 'string' ? provider.name : '';
            const providerLocation = typeof provider?.location === 'string' ? provider.location : '';
            const providerServices = Array.isArray(provider?.services) ? provider.services : [];
            const servicesText = providerServices
                .map((s) => (typeof s?.name === 'string' ? s.name : ''))
                .join(' ');

            const _providerCategory = typeof provider?.category === 'string' ? provider.category : '';
            
            let catId = "all";
            if (isCraftsmanProvider(_providerCategory)) catId = "صنايعية";
            else if (isPharmacyProvider(_providerCategory)) catId = "صيدليات";
            else if (isDoctorProvider(_providerCategory)) catId = "دكتور وممرض";
            else if (isMaintenanceProvider(_providerCategory)) catId = "صيانة";
            else if (isCarServiceProvider(_providerCategory)) catId = "سيارات";
            else if (isPlaygroundProvider(_providerCategory)) catId = "ملاعب";
            else if (_providerCategory.includes('بقالة') || _providerCategory.includes('سوبر') || _providerCategory.includes('ماركت') || _providerCategory.includes('خضار') || _providerCategory.includes('لحوم')) {
                catId = "بقالة";
            }
            else if (isRestaurantProvider(_providerCategory)) {
                catId = "مطاعم";
            } else {
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

    // Count providers per category for high-tech counters
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: normalizedProviders.length };
        normalizedProviders.forEach(p => {
            if (p._mappedCategoryId) {
                counts[p._mappedCategoryId] = (counts[p._mappedCategoryId] || 0) + 1;
            }
        });
        return counts;
    }, [normalizedProviders]);

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

    const isFiltered = activeCategory !== "all" || searchQuery.length > 0 || sortBy !== "default";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 pb-24 md:pb-12 font-cairo selection:bg-indigo-500 selection:text-white">
            
            {/* Background Ambient Glowing Orbs */}
            <div className="fixed top-0 inset-x-0 h-[450px] bg-gradient-to-b from-indigo-900/10 via-purple-900/5 to-transparent pointer-events-none -z-10 blur-3xl overflow-hidden" />
            <div className="fixed top-20 right-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
            <div className="fixed top-40 left-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* Add Item Banner if arriving from existing order */}
            {addToOrderId && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 sticky top-0 z-[60] shadow-xl flex items-center justify-between mb-6 mx-4 rounded-2xl border border-emerald-400/30 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <ShoppingBag className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-black text-lg">إضافة خيارات للطلب #{addToOrderId}</p>
                            <p className="text-xs opacity-90 font-medium">تصفح الخدمات واختر ما تحتاجه لإضافته فوراً</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push(`/track/${addToOrderId}`)}
                        className="px-5 py-2.5 bg-white text-emerald-800 rounded-xl font-black text-sm hover:bg-emerald-50 transition-all shadow-md active:scale-95"
                    >
                        العودة للطلب
                    </button>
                </div>
            )}

            <div className="container max-w-7xl mx-auto px-4 lg:px-8">
                
                {/* Creative Hero Banner */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 mb-8 border border-slate-800 shadow-2xl"
                >
                    {/* Glowing decorative elements */}
                    <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 max-w-3xl space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 backdrop-blur-md text-xs sm:text-sm font-bold text-indigo-300">
                            <Zap className="w-4 h-4 text-indigo-400 animate-bounce" />
                            <span>دليل خدمات أسيوط الجديدة المباشر</span>
                        </div>

                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white font-cairo">
                            استكشف <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">أفضل الخدمات والأنشطة</span> في أسيوط الجديدة 🌟
                        </h1>
                        <p className="text-slate-300 text-sm sm:text-base font-medium max-w-2xl leading-relaxed">
                            اعثر فوراً على السباكين، المطاعم، الصيدليات، الدكاترة والمحلات الموثوقة مع تواصل مباشر وبدون عمولات.
                        </p>

                        {/* Search Input Box */}
                        <div className="pt-4">
                            <div className="relative flex items-center group">
                                <Search className="absolute right-4 w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                <Input
                                    placeholder="ابحث عن سباك، مطعم، صيدلية، تكييف..."
                                    className="pr-12 pl-12 h-14 bg-white/10 dark:bg-slate-950/60 backdrop-blur-md border-slate-700/80 text-white placeholder:text-slate-400 rounded-2xl text-base font-medium focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-inner"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute left-4 p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Quick Search Tag Pills */}
                            <div className="flex flex-wrap items-center gap-2 mt-4 pt-1">
                                <span className="text-xs text-slate-400 font-bold ml-1">الأكثر بحثاً:</span>
                                {QUICK_TAGS.map((tag, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSearchQuery(tag.query)}
                                        className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 transition-all active:scale-95 cursor-pointer"
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Interactive Categories Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" />
                            <span>الأقسام المتاحة</span>
                        </h2>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {normalizedProviders.length} مزود خدمة مسجّل
                        </span>
                    </div>

                    <div className="flex overflow-x-auto pb-3 gap-3 no-scrollbar scroll-smooth">
                        {CATEGORIES.map((cat) => {
                            const count = categoryCounts[cat.id] || 0;
                            const isActive = activeCategory === cat.id;

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={cn(
                                        "flex items-center gap-2.5 px-5 py-3 rounded-2xl whitespace-nowrap transition-all duration-300 text-sm font-bold border cursor-pointer shrink-0 relative overflow-hidden group shadow-sm",
                                        isActive
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg shadow-indigo-500/10 scale-[1.02]"
                                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                                    )}
                                >
                                    {cat.icon && (
                                        <div className={cn(
                                            "w-7 h-7 rounded-xl flex items-center justify-center transition-colors",
                                            isActive
                                                ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                                                : cat.bgLight
                                        )}>
                                            <cat.icon className="h-4 w-4" />
                                        </div>
                                    )}
                                    <span>{cat.label}</span>
                                    {count > 0 && (
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full font-bold transition-colors",
                                            isActive
                                                ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Controls & Quick Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    {/* Active summary status */}
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold w-full sm:w-auto justify-between sm:justify-start">
                        <span>
                            نتائج البحث: <span className="text-indigo-600 dark:text-indigo-400 font-black">{filteredProviders.length}</span> مزود
                        </span>
                        {isFiltered && (
                            <button
                                onClick={() => {
                                    setActiveCategory('all');
                                    setSearchQuery('');
                                    setSortBy('default');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-bold mr-2 hover:underline cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>إعادة ضبط</span>
                            </button>
                        )}
                    </div>

                    {/* Sorting & Layout View Toggle */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {/* Sort Dropdown */}
                        <div className="relative h-11 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center px-3 font-bold text-xs cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                            <select 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="w-full h-full bg-transparent outline-none appearance-none pl-6 pr-1 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                            >
                                <option value="default" className="text-slate-900">⚡ الترتيب الافتراضي</option>
                                <option value="top-rated" className="text-slate-900">⭐ الأعلى تقييماً</option>
                                <option value="most-ordered" className="text-slate-900">🔥 الأكثر طلباً</option>
                                <option value="most-offers" className="text-slate-900">🎁 الأكثر عروضاً</option>
                            </select>
                            <div className="absolute left-2.5 pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>

                        {/* View Switcher */}
                        <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    viewMode === "grid" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                                title="عرض شبكي"
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    viewMode === "list" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                                title="عرض كقائمة"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Service Cards Grid Container */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${activeCategory}-${debouncedSearchQuery}-${sortBy}-${viewMode}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                            "grid gap-6",
                            viewMode === "grid"
                                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                                : "grid-cols-1"
                        )}
                    >
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <SkeletonCard key={`skeleton-${i}`} />
                            ))
                        ) : displayedProviders.length > 0 ? (
                            displayedProviders.map((provider) => (
                                <ServiceCard 
                                    key={provider.id} 
                                    provider={provider} 
                                    addToOrderId={addToOrderId} 
                                />
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="col-span-full flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center"
                            >
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                                    <Search className="h-10 w-10 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 font-cairo">لا توجد نتائج تطابق بحثك</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6 font-medium">
                                    جرب تغيير الكلمات المفتاحية أو اختر قسماً آخر من الأقسام المتاحة أعلاه.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="px-6 py-3 rounded-xl border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-bold text-indigo-600 dark:text-indigo-400"
                                    onClick={() => { setActiveCategory("all"); setSearchQuery(""); setSortBy("default"); }}
                                >
                                    عرض جميع الخدمات
                                </Button>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Load More Button */}
                {!isLoading && visibleCount < filteredProviders.length && (
                    <div className="mt-12 text-center">
                        <Button 
                            onClick={handleLoadMore} 
                            className="px-10 py-6 rounded-2xl font-black text-base bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg hover:shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer font-cairo"
                        >
                            عرض المزيد من الخدمات ({filteredProviders.length - visibleCount} متبقي)
                        </Button>
                    </div>
                )}
            </div>

            {/* Mobile Floating Cart Action */}
            <AnimatePresence>
                {globalCart.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0, opacity: 0, y: 20 }}
                        onClick={() => setIsCartOpen(true)}
                        className="fixed bottom-24 md:bottom-6 left-6 z-50 bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 group hover:scale-105 active:scale-95 transition-all md:hidden font-cairo border border-indigo-400/40"
                    >
                        <div className="relative">
                            <ShoppingCart className="w-6 h-6" />
                            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-indigo-600">
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
        <Suspense fallback={
            <div className="container mx-auto p-8 font-cairo">
                <div className="h-40 w-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-3xl mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-3xl" />
                    ))}
                </div>
            </div>
        }>
            <ExploreContent />
        </Suspense>
    );
}
