"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, MapPin } from "lucide-react"
import { useState } from "react"
import { BookingModal } from "./booking-modal"
import { AuthGuardModal } from "./auth-guard-modal";
import { useAppStore } from "@/hooks/use-app-store";

export interface ServiceProvider {
    id: string
    name: string
    category: string
    rating: number
    reviews: number
    location: string
    image?: string
    services?: Array<{
        id: string;
        name: string;
        description?: string;
        price: number;
        image?: string;
    }>;
}

export function ServiceCard({ provider }: { provider: ServiceProvider }) {
    const router = useRouter();
    const { currentUser } = useAppStore();
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    // Robust check for category
    const isOrder = provider.category.includes("مطعم") ||
        provider.category.includes("مطاعم") ||
        provider.category.includes("بقالة") ||
        provider.category.includes("سوبر") ||
        provider.category.includes("صيدلي");

    const ctaText = isOrder ? "اطلب الآن" : "احجز موعد";

    // Dynamic styling based on category
    let headerColor = "bg-slate-100";
    let iconColor = "text-slate-400";

    if (provider.category.includes("مطعم")) { headerColor = "bg-orange-100"; iconColor = "text-orange-500"; }
    else if (provider.category.includes("صيانة")) { headerColor = "bg-blue-100"; iconColor = "text-blue-500"; }
    else if (provider.category.includes("طبي")) { headerColor = "bg-green-100"; iconColor = "text-green-500"; }

    const [showAuthGuard, setShowAuthGuard] = useState(false);

    const handleBookingClick = () => {
        if (!currentUser) {
            setShowAuthGuard(true);
            return;
        }
        setIsBookingOpen(true);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="h-full"
            >
                <Card className="overflow-hidden hover:shadow-xl transition-all border-none shadow-md h-full flex flex-col group bg-white">
                    <div className={`relative h-40 w-full ${headerColor} flex items-center justify-center overflow-hidden`}>
                        <div className={`text-6xl font-bold opacity-20 ${iconColor} select-none group-hover:scale-110 transition-transform duration-500`}>
                            {provider.name.charAt(0)}
                        </div>
                    </div>
                    <CardContent className="p-4 flex-1 relative">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 line-clamp-1">{provider.name}</h3>
                                <p className="text-sm text-slate-500 font-medium">{provider.category}</p>
                            </div>
                            <div className={`flex items-center gap-1 ${provider.reviews > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-slate-50 border-slate-100'} px-2 py-1 rounded-full border`}>
                                <Star className={`h-3 w-3 ${provider.reviews > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'}`} />
                                <span className="text-xs font-bold text-slate-700">{provider.reviews > 0 ? provider.rating : 0}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span>{provider.location}</span>
                        </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 gap-2">
                        <Button className="flex-1" variant="outline" onClick={() => router.push(`/provider/${provider.id}`)}>
                            التفاصيل
                        </Button>
                        <Button
                            className={`flex-1 gap-2 text-white shadow-lg rounded-xl font-bold ${isOrder ? "bg-orange-500 hover:bg-orange-600 shadow-orange-200" : "bg-primary hover:bg-primary/90 shadow-primary/20"}`}
                            variant="default"
                            onClick={handleBookingClick}
                        >
                            {ctaText}
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>

            <BookingModal
                provider={provider}
                open={isBookingOpen}
                onOpenChange={setIsBookingOpen}
            />

            <AuthGuardModal
                open={showAuthGuard}
                onClose={() => setShowAuthGuard(false)}
                onLogin={() => router.push("/login/user")}
            />
        </>
    )
}
