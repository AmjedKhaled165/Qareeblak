import HomeClient from "@/components/home/HomeClient";
import { Suspense } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "قريبلك | الرئيسية",
    description: "خدمات أسيوط الجديدة بين يديك في ثواني. اطلب صيانة، طعام، صيدليات والمزيد في تطبيق واحد.",
};

export default function HomePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xl font-bold text-slate-600 dark:text-slate-300">جاري التحميل...</p>
                </div>
            }
        >
            <HomeClient />
        </Suspense>
    );
}
