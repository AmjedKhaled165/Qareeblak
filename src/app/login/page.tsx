"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useEffect, useRef } from "react";
import VanillaTilt from "vanilla-tilt";

function Glyph({ symbol, className = "" }: { symbol: string; className?: string }) {
    return <span aria-hidden="true" className={className}>{symbol}</span>;
}

export default function LoginPage() {
    const router = useRouter();
    const { currentUser, isLoading } = useAppStore();
    const customerCardRef = useRef<HTMLDivElement>(null);
    const providerCardRef = useRef<HTMLDivElement>(null);

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

    // Initialize 3D tilt effect on cards
    useEffect(() => {
        if (customerCardRef.current) {
            VanillaTilt.init(customerCardRef.current, {
                max: 15,
                speed: 400,
                scale: 1.05,
                transition: true
            });
        }
        if (providerCardRef.current) {
            VanillaTilt.init(providerCardRef.current, {
                max: 15,
                speed: 400,
                scale: 1.05,
                transition: true
            });
        }

        return () => {
            const customerEl = customerCardRef.current as any;
            const providerEl = providerCardRef.current as any;
            if (customerEl?.vanillaTilt) customerEl.vanillaTilt.destroy();
            if (providerEl?.vanillaTilt) providerEl.vanillaTilt.destroy();
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
            {/* Animated Background Shapes with Glassmorphism */}
            
            {/* Large Blob 1 - Top Right */}
            <motion.div
                animate={{
                    x: [0, 30, -20, 0],
                    y: [0, -40, 20, 0],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[100px] z-0 opacity-60"
                style={{
                    background: "linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(147, 51, 234) 100%)",
                }}
            />

            {/* Large Blob 2 - Bottom Left */}
            <motion.div
                animate={{
                    x: [0, -30, 20, 0],
                    y: [0, 40, -20, 0],
                }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[100px] z-0 opacity-60"
                style={{
                    background: "linear-gradient(135deg, rgb(165, 142, 251) 0%, rgb(234, 179, 8) 100%)",
                }}
            />

            {/* Small Floating Shape - Center-Left */}
            <motion.div
                animate={{
                    rotate: [0, 360],
                    x: [0, 50, -50, 0],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute left-[10%] top-[30%] w-64 h-64 rounded-full blur-[80px] z-0 opacity-40"
                style={{
                    background: "linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(59, 130, 246) 100%)",
                }}
            />

            {/* Geometric Shape - Top Center (animated clip-path) */}
            <motion.div
                animate={{
                    rotate: [0, -360],
                    scale: [1, 1.2, 0.9, 1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[20%] left-1/2 w-80 h-80 blur-[60px] z-0 opacity-30 transform -translate-x-1/2"
                style={{
                    background: "linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)",
                    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
                }}
            />

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
                    className="flex-1 h-full"
                    ref={customerCardRef}
                    style={{
                        transformStyle: "preserve-3d",
                        perspective: "1000px",
                    } as React.CSSProperties}
                >
                    <Card className="h-full cursor-pointer border shadow-2xl bg-gradient-to-br from-white/90 to-white/70 dark:from-slate-900/60 dark:to-slate-800/40 backdrop-blur-2xl border-white/40 dark:border-white/10 rounded-[3rem] overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:border-primary/50 relative before:absolute before:inset-0 before:rounded-[3rem] before:bg-gradient-to-br before:from-primary/5 before:to-secondary/5 before:opacity-0 before:group-hover:opacity-100 before:transition-opacity before:duration-300">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-6 border border-primary/30 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10">
                                <Glyph symbol="👤" className="text-5xl" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 font-cairo">أنا عميل</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-[250px] flex-1 text-lg font-medium font-cairo">
                                عايز أطلب أكل، أحجز صيانة، أو أدور على خدمات في المدينة.
                            </p>
                            <Button className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-xl font-bold shadow-lg shadow-primary/30 mt-auto transition-all active:scale-95 relative overflow-hidden group/btn">
                                <span className="relative z-10">دخول كمستخدم</span>
                                <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500" />
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Unified Service Provider Card */}
                <motion.div
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/login/provider")}
                    className="flex-1 h-full"
                    ref={providerCardRef}
                    style={{
                        transformStyle: "preserve-3d",
                        perspective: "1000px",
                    } as React.CSSProperties}
                >
                    <Card className="h-full cursor-pointer border shadow-2xl bg-gradient-to-br from-white/90 to-white/70 dark:from-slate-900/60 dark:to-slate-800/40 backdrop-blur-2xl border-white/40 dark:border-white/10 rounded-[3rem] overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:border-secondary/50 relative before:absolute before:inset-0 before:rounded-[3rem] before:bg-gradient-to-br before:from-secondary/5 before:to-primary/5 before:opacity-0 before:group-hover:opacity-100 before:transition-opacity before:duration-300">
                        <CardContent className="p-10 flex flex-col items-center text-center h-full relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-3xl flex items-center justify-center mb-6 border border-secondary/30 group-hover:scale-110 group-hover:-rotate-3 transition-transform shadow-lg shadow-secondary/10">
                                <Glyph symbol="🏪" className="text-5xl" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 font-cairo">أنا مقدم خدمة</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-[250px] flex-1 text-lg font-medium font-cairo">
                                صاحب مطعم، محل، أو صنايعي وعايز أدير شغلي وأستقبل طلبات.
                            </p>
                            <Button className="w-full h-16 rounded-2xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-white text-xl font-bold shadow-lg shadow-secondary/30 mt-auto transition-all active:scale-95 relative overflow-hidden group/btn">
                                <span className="relative z-10">دخول كشريك</span>
                                <span className="absolute inset-0 bg-gradient-to-r from-secondary/0 via-white/20 to-secondary/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500" />
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

