"use client";

import { ServiceCard } from "@/components/features/service-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Utensils, Wrench, Pill, Car, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import { useAppStore } from "@/hooks/use-app-store";

const CATEGORIES = [
    { id: "all", label: "الكل", icon: null },
    { id: "مطاعم", label: "مطاعم وكافيهات", icon: Utensils },
    { id: "صيانة", label: "صيانة وسباكة", icon: Wrench },
    { id: "طبي", label: "طبي وصيدليات", icon: Pill },
    { id: "سيارات", label: "خدمات سيارات", icon: Car },
    { id: "بقالة", label: "سوبر ماركت", icon: ShoppingBag },
];

export default function ExplorePage() {
    const { providers, isInitialized, currentUser } = useAppStore();
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    if (!isInitialized) return null; // Avoid hydration mismatch

    const filteredProviders = providers.filter(provider => {
        const matchesCategory = activeCategory === "all" || provider.category === activeCategory;
        const matchesSearch = provider.name.includes(searchQuery) ||
            provider.location.includes(searchQuery) ||
            provider.services?.some(s => s.name.includes(searchQuery));
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-slate-50/50 py-8">
            <div className="container mx-auto px-4">
                {/* Header & Filter */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">تصفح الخدمات</h1>
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
                                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium border",
                                activeCategory === cat.id
                                    ? "bg-primary text-white border-primary shadow-md hover:bg-primary/90"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
                    {filteredProviders.length > 0 ? (
                        filteredProviders.map((provider) => (
                            <ServiceCard key={provider.id} provider={provider} />
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="col-span-full flex flex-col items-center justify-center py-20 text-center"
                        >
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                <Search className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">لا توجد نتائج</h3>
                            <p className="text-muted-foreground mb-4">لم نجد أي خدمات تطابق بحثك في هذا القسم.</p>
                            <Button variant="outline" onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}>عرض كل الخدمات</Button>
                        </motion.div>
                    )}
                </motion.div>

                {/* Load More */}
                {filteredProviders.length > 0 && (
                    <div className="mt-12 text-center">
                        <Button variant="ghost">عرض المزيد</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
