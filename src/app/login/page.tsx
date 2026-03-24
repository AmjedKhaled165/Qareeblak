"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useEffect } from "react";

function Glyph({ symbol, className = "" }: { symbol: string; className?: string }) {
    return <span aria-hidden="true" className={className}>{symbol}</span>;
}

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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
            {/* Visual Blobs for Login Background */}
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-[100px] z-0" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-12 relative z-10"
            >
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-3 font-cairo">
                    <span className="text-4xl">👋</span> أهلاً بك في قريبلك
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xl font-medium font-cairo">سجل دخولك عشان تقدر تستفيد بكل المميزات</p>
            </motion.div>

            <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl justify-center relative z-10">

                {/* Customer Card */}
                <motion.div
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/login/user")}
                    className="flex-1"
                >
                    <Card className="h-full cursor-pointer border shadow-xl bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border-slate-200 dark:border-white/5 rounded-[3rem] overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:border-primary/50">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full">
                            <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                <Glyph symbol="👤" className="text-5xl" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 font-cairo">أنا عميل</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-[250px] flex-1 text-lg font-medium font-cairo">
                                عايز أطلب أكل، أحجز صيانة، أو أدور على خدمات في المدينة.
                            </p>
                            <Button className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xl font-bold shadow-lg shadow-primary/20 mt-auto transition-all active:scale-95">
                                دخول كمستخدم
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Unified Service Provider Card */}
                <motion.div
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/login/provider")}
                    className="flex-1"
                >
                    <Card className="h-full cursor-pointer border shadow-xl bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border-slate-200 dark:border-white/5 rounded-[3rem] overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:border-secondary/50">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full">
                            <div className="w-24 h-24 bg-secondary/10 rounded-3xl flex items-center justify-center mb-6 border border-secondary/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                                <Glyph symbol="🏪" className="text-5xl" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 font-cairo">أنا مقدم خدمة</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-[250px] flex-1 text-lg font-medium font-cairo">
                                صاحب مطعم، محل، أو صنايعي وعايز أدير شغلي وأستقبل طلبات.
                            </p>
                            <Button className="w-full h-16 rounded-2xl bg-secondary hover:bg-secondary/90 text-white text-xl font-bold shadow-lg shadow-secondary/20 mt-auto transition-all active:scale-95">
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
                <Link href="/" className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-bold text-xl group font-cairo">
                    <span className="group-hover:-translate-x-2 transition-transform">→</span>
                    العودة للرئيسية
                </Link>
            </motion.div>
        </div>
    );
}

