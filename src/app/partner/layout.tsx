"use client";

import { CourierTrackingProvider } from "@/providers/courier-tracking-provider";
import { TrackingGuard } from "@/components/partner/tracking-guard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <CourierTrackingProvider>
            <TrackingGuard>
                <div className="relative min-h-screen">
                    <div className="fixed bottom-6 left-6 z-[60] md:bottom-10 md:left-10">
                        <div className="bg-card/80 backdrop-blur-md p-2 rounded-full shadow-2xl border border-border">
                            <ThemeToggle />
                        </div>
                    </div>
                    {children}
                </div>
            </TrackingGuard>
        </CourierTrackingProvider>
    );
}
