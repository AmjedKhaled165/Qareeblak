"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Store, ArrowLeft, Truck } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useEffect } from "react";

export default function LoginPage() {
    const router = useRouter();
    const { currentUser, isLoading } = useAppStore();

    useEffect(() => {
        if (!isLoading && currentUser) {
            console.log("Already logged in, redirecting...", currentUser.type);
            if (currentUser.type === 'provider' || currentUser.type?.includes('partner')) {
                router.replace("/provider-dashboard");
            } else {
                router.replace("/");
            }
        }
    }, [currentUser, isLoading, router]);

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Visual Blobs for Login Background */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-[100px] z-0" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-12 relative z-10"
            >
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                    <span className="text-4xl">👋</span> أهلاً بك في قريبلك
                </h1>
                <p className="text-slate-400 text-lg font-medium">سجل دخولك عشان تقدر تستفيد بكل المميزات</p>
            </motion.div>

            <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl justify-center relative z-10">

                {/* Customer Card matching Image #2 */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/login/user")}
                    className="flex-1"
                >
                    <Card className="h-full cursor-pointer border-0 shadow-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden group">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full">
                            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                                <User className="w-10 h-10 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 font-cairo">أنا عميل</h2>
                            <p className="text-slate-400 mb-8 max-w-[250px] flex-1">
                                عايز أطلب أكل، أحجز صيانة، أو أدور على خدمات في المدينة.
                            </p>
                            <Button className="w-full h-14 rounded-[1.25rem] bg-primary hover:bg-primary/90 text-white text-lg font-bold shadow-lg shadow-primary/20 mt-auto">
                                دخول كمستخدم
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Unified Service Provider Card matching Image #2 */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/login/provider")}
                    className="flex-1"
                >
                    <Card className="h-full cursor-pointer border-0 shadow-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden group">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full">
                            <div className="w-24 h-24 bg-secondary/10 rounded-full flex items-center justify-center mb-6 border border-secondary/20">
                                <Store className="w-10 h-10 text-secondary" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 font-cairo">أنا مقدم خدمة</h2>
                            <p className="text-slate-400 mb-8 max-w-[250px] flex-1">
                                صاحب مطعم، محل، أو صنايعي وعايز أدير شغلي وأستقبل طلبات.
                            </p>
                            <Button className="w-full h-14 rounded-[1.25rem] bg-secondary hover:bg-secondary/90 text-white text-lg font-bold shadow-lg shadow-secondary/20 mt-auto">
                                دخول كشريك
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 relative z-10"
            >
                <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-bold text-lg">
                    <ArrowLeft className="w-5 h-5 -rotate-180" />
                    العودة للرئيسية
                </Link>
            </motion.div>
        </div>
    );
}

