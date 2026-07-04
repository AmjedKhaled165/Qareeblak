"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, MapPin } from "lucide-react"

export interface ServiceProvider {
    id: string
    name: string
    category: string
    rating: number
    reviews: number
    location: string
    image?: string
    reviewsList?: Array<{
        id: string;
        rating: number;
        comment?: string;
    }>;
    services?: Array<{
        id: string;
        name: string;
        description?: string;
        price: number;
        image?: string;
    }>;
}

export function ServiceCard({ provider, addToOrderId }: { provider: ServiceProvider, addToOrderId?: string | null }) {
    const router = useRouter();
    const providerName = provider?.name || "مقدم خدمة";
    const providerCategory = provider?.category || "عام";
    const providerLocation = provider?.location || "غير محدد";

    const isPharmacy = providerCategory.includes("صيدل");
    const isOrder = providerCategory.includes("مطعم") ||
        providerCategory.includes("مطاعم") ||
        providerCategory.includes("بقالة") ||
        providerCategory.includes("سوبر");

    const ctaText = addToOrderId 
        ? "أضف للطلب" 
        : isPharmacy 
            ? "تواصل أو اطلب"
            : (isOrder ? "اطلب الآن" : "احجز موعد");

    // Dynamic styling based on category
    let headerColor = "bg-accent/50";
    let iconColor = "text-muted-foreground/30";

    if (providerCategory.includes("مطعم")) {
        headerColor = "bg-orange-100 dark:bg-orange-950/30";
        iconColor = "text-orange-500 dark:text-orange-400";
    }
    else if (providerCategory.includes("صيانة")) {
        headerColor = "bg-blue-100 dark:bg-blue-950/30";
        iconColor = "text-blue-500 dark:text-blue-400";
    }
    else if (providerCategory.includes("صيدل")) {
        headerColor = "bg-green-100 dark:bg-green-950/30";
        iconColor = "text-green-500 dark:text-green-400";
    }
    else if (providerCategory.includes("دكتور") || providerCategory.includes("ممرض")) {
        headerColor = "bg-cyan-100 dark:bg-cyan-950/30";
        iconColor = "text-cyan-500 dark:text-cyan-400";
    }
    else if (providerCategory.includes("ملاعب")) {
        headerColor = "bg-green-100 dark:bg-green-950/30";
        iconColor = "text-green-500 dark:text-green-400";
    }



    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
            className="h-full group cursor-pointer"
            onClick={() => router.push(`/provider/${provider.id}${addToOrderId ? `?addToOrderId=${addToOrderId}` : ""}`)}
        >
            <div className="relative h-full flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_40px_-15px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300 group-hover:shadow-[0_20px_60px_-15px_rgba(79,70,229,0.15)] group-hover:border-indigo-100 dark:group-hover:border-indigo-500/30">
                
                {/* Premium Abstract Header */}
                <div className="relative h-24 sm:h-32 w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                    <div className="absolute inset-0 opacity-40 mix-blend-multiply dark:mix-blend-screen">
                        {/* Dynamic category-based blobs */}
                        <div className={`absolute -top-10 -left-10 w-40 h-40 rounded-full blur-[40px] ${
                            providerCategory.includes("مطعم") ? "bg-orange-400" : 
                            providerCategory.includes("صيانة") ? "bg-blue-400" : 
                            providerCategory.includes("صيدل") ? "bg-emerald-400" : 
                            providerCategory.includes("ملاعب") ? "bg-green-400" : 
                            providerCategory.includes("دكتور") || providerCategory.includes("ممرض") ? "bg-cyan-400" : "bg-indigo-400"
                        }`} />
                        <div className={`absolute bottom-[-20px] -right-10 w-40 h-40 rounded-full blur-[50px] ${
                            providerCategory.includes("مطعم") ? "bg-rose-400" : 
                            providerCategory.includes("صيانة") ? "bg-cyan-400" : 
                            providerCategory.includes("صيدل") ? "bg-teal-400" : 
                            providerCategory.includes("ملاعب") ? "bg-emerald-400" : 
                            providerCategory.includes("دكتور") || providerCategory.includes("ممرض") ? "bg-sky-400" : "bg-violet-400"
                        }`} />
                    </div>
                </div>

                {/* Avatar / Profile Picture */}
                <div className="absolute top-16 right-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 rotate-3 transition-transform duration-500 group-hover:rotate-0">
                            <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                {provider.image ? (
                                    <img src={provider.image} alt={providerName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                    <span className={`text-3xl font-black ${
                                        providerCategory.includes("مطعم") ? "text-orange-500" : 
                                        providerCategory.includes("صيانة") ? "text-blue-500" : 
                                        providerCategory.includes("صيدل") ? "text-emerald-500" : 
                                        providerCategory.includes("ملاعب") ? "text-green-500" : 
                                        providerCategory.includes("دكتور") || providerCategory.includes("ممرض") ? "text-cyan-500" : "text-indigo-500"
                                    }`}>
                                        {providerName.charAt(0)}
                                    </span>
                                )}
                            </div>
                        </div>
                        {Number(provider.rating) >= 4.5 && (
                            <div className="absolute -bottom-2 -left-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white dark:border-slate-800 rotate-[-12deg]">
                                متميز
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="pt-8 px-6 pb-6 flex-1 flex flex-col relative z-10">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <h3 className="font-bold text-xl text-slate-900 dark:text-white line-clamp-1 font-cairo pr-1">{providerName}</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 pr-1">{providerCategory}</p>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 px-2.5 py-1.5 rounded-xl shadow-sm">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{Number(provider.rating) > 0 ? Number(provider.rating).toFixed(1) : "جديد"}</span>
                            <div className="flex gap-0.5 mt-0.5">
                                <Star className={`w-3 h-3 ${Number(provider.rating) > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-6 mt-3 bg-slate-50 dark:bg-slate-800/50 w-fit px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <MapPin className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="line-clamp-1 truncate font-medium">{providerLocation}</span>
                    </div>

                    <div className="mt-auto pt-2">
                        <Button
                            className={`w-full h-12 gap-2 text-white shadow-lg rounded-xl font-bold font-cairo text-base group-hover:scale-[1.02] transition-all duration-300 ${
                                isOrder 
                                ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 shadow-orange-500/25 border-b-4 border-orange-700 active:translate-y-1 active:border-b-0" 
                                : "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-indigo-500/25 border-b-4 border-indigo-700 active:translate-y-1 active:border-b-0"
                            }`}
                            variant="default"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/provider/${provider.id}${addToOrderId ? `?addToOrderId=${addToOrderId}` : ""}`);
                            }}
                        >
                            {ctaText}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
