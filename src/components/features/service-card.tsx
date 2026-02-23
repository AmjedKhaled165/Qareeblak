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

    // Robust check for category
    const isOrder = provider.category.includes("مطعم") ||
        provider.category.includes("مطاعم") ||
        provider.category.includes("بقالة") ||
        provider.category.includes("سوبر") ||
        provider.category.includes("صيدلي");

    const ctaText = addToOrderId ? "أضف للطلب" : (isOrder ? "اطلب الآن" : "احجز موعد");

    // Dynamic styling based on category
    let headerColor = "bg-accent/50";
    let iconColor = "text-muted-foreground/30";

    if (provider.category.includes("مطعم")) {
        headerColor = "bg-orange-100 dark:bg-orange-950/30";
        iconColor = "text-orange-500 dark:text-orange-400";
    }
    else if (provider.category.includes("صيانة")) {
        headerColor = "bg-blue-100 dark:bg-blue-950/30";
        iconColor = "text-blue-500 dark:text-blue-400";
    }
    else if (provider.category.includes("طبي")) {
        headerColor = "bg-green-100 dark:bg-green-950/30";
        iconColor = "text-green-500 dark:text-green-400";
    }



    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="h-full"
        >
            <Card
                className="overflow-hidden hover:shadow-xl transition-all border border-border shadow-sm h-full flex flex-col group bg-card cursor-pointer"
                onClick={() => router.push(`/provider/${provider.id}${addToOrderId ? `?addToOrderId=${addToOrderId}` : ""}`)}
            >
                <div className={`relative h-40 w-full ${headerColor} flex items-center justify-center overflow-hidden`}>
                    <div className={`text-6xl font-bold opacity-20 ${iconColor} select-none group-hover:scale-110 transition-transform duration-500`}>
                        {provider.name.charAt(0)}
                    </div>
                </div>
                <CardContent className="p-4 flex-1 relative">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-lg text-foreground line-clamp-1">{provider.name}</h3>
                            <p className="text-sm text-muted-foreground font-medium">{provider.category}</p>
                        </div>
                        <div className={`flex items-center gap-1 ${Number(provider.rating) > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-100 dark:border-yellow-900/50' : 'bg-accent border-border'} px-2 py-1 rounded-full border`}>
                            <Star className={`h-3 w-3 ${Number(provider.rating) > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                            <span className="text-xs font-bold text-foreground">
                                {Number(provider.rating) > 0 ? Number(provider.rating).toFixed(1) : "0.0"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{provider.location}</span>
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    <Button
                        className={`w-full gap-2 text-white shadow-lg rounded-xl font-bold ${isOrder ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"}`}
                        variant="default"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent double navigation if card is clickable
                            router.push(`/provider/${provider.id}${addToOrderId ? `?addToOrderId=${addToOrderId}` : ""}`);
                        }}
                    >
                        {ctaText}
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    )
}
