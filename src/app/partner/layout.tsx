"use client";

import { CourierTrackingProvider } from "@/components/providers/CourierTrackingProvider";
import { TrackingGuard } from "@/components/partner/tracking-guard";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { motion } from "framer-motion";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <CourierTrackingProvider>
            <TrackingGuard>
                <div className="relative min-h-screen">
                    <motion.div
                        drag
                        dragMomentum={false}
                        className="fixed bottom-6 right-6 z-[100] md:bottom-10 md:right-10 cursor-move"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <div className="bg-card/80 backdrop-blur-md p-2 rounded-full shadow-2xl border border-border">
                            <ThemeToggle />
                        </div>
                    </motion.div>
                    {children}
                </div>
            </TrackingGuard>
        </CourierTrackingProvider>
    );
}
