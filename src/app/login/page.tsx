"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Store, ArrowLeft, Truck } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-10"
            >
                <h1 className="text-4xl font-bold text-slate-900 mb-2">أهلاً بك في قريبلك 👋</h1>
                <p className="text-slate-500 text-lg">سجل دخولك عشان تقدر تستفيد بكل المميزات</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 w-full max-w-6xl">

                {/* Customer Card */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => router.push("/login/user")}
                >
                    <Card className="h-full cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all border-2 border-transparent relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="p-8 flex flex-col items-center text-center h-full justify-center">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <User className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">أنا عميل</h2>
                            <p className="text-slate-500 mb-8">
                                عايز أطلب أكل، أحجز صيانة، أو أدور على خدمات في المدينة.
                            </p>
                            <div className="w-full h-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium shadow hover:bg-primary/90">
                                دخول كمستخدم
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Service Provider Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => router.push("/login/provider")}
                >
                    <Card className="h-full cursor-pointer hover:border-orange-500/50 hover:shadow-xl transition-all border-2 border-transparent relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="p-8 flex flex-col items-center text-center h-full justify-center">
                            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Store className="w-10 h-10 text-orange-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">أنا مقدم خدمة</h2>
                            <p className="text-slate-500 mb-8">
                                صاحب مطعم، محل، أو صنايعي وعايز أدير شغلي وأستقبل طلبات.
                            </p>
                            <div className="w-full h-12 rounded-md bg-orange-500 text-white flex items-center justify-center text-lg font-medium shadow hover:bg-orange-600">
                                دخول كشريك
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Partner/Halan Card */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => router.push("/login/partner")}
                >
                    <Card className="h-full cursor-pointer hover:border-violet-500/50 hover:shadow-xl transition-all border-2 border-transparent relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="p-8 flex flex-col items-center text-center h-full justify-center">
                            <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Truck className="w-10 h-10 text-violet-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-3">أنا شريك توصيل</h2>
                            <p className="text-slate-500 mb-8">
                                سائق توصيل أو مشرف في نظام حالاً لإدارة التوصيل.
                            </p>
                            <div className="w-full h-12 rounded-md bg-gradient-to-r from-violet-600 to-blue-600 text-white flex items-center justify-center text-lg font-medium shadow hover:from-violet-700 hover:to-blue-700">
                                دخول لحالاً 🚚
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-10"
            >
                <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    العودة للرئيسية
                </Link>
            </motion.div>
        </div>
    );
}

