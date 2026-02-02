"use client";

import { CourierTrackingProvider } from "@/providers/courier-tracking-provider";
import { TrackingGuard } from "@/components/partner/tracking-guard";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <CourierTrackingProvider>
            <TrackingGuard>
                {children}
            </TrackingGuard>
        </CourierTrackingProvider>
    );
}
