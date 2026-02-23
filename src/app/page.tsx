"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Wrench, Utensils, Pill, Car, Zap, Home, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function HomePage() {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToOrderId = searchParams.get('addToOrderId');

  useEffect(() => {
    if (currentUser?.type === 'provider') {
      router.replace('/provider-dashboard');
    }
  }, [currentUser, router]);

  // If provider, return null while redirecting to avoid flash of content
  if (currentUser?.type === 'provider') return null;

  const categories = [
    { name: "مطاعم وكافيهات", icon: Utensils, colorClass: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" },
    { name: "صيانة وسباكة", icon: Wrench, colorClass: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" },
    { name: "صيدليات", icon: Pill, colorClass: "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400" },
    { name: "كهرباء", icon: Zap, colorClass: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400" },
    { name: "سيارات", icon: Car, colorClass: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
    { name: "خدمات منزلية", icon: Home, colorClass: "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Add Item Banner */}
      {addToOrderId && (
        <div className="bg-green-600 text-white p-4 sticky top-0 z-[60] shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold">أنت الآن تضيف منتجات للطلب #{addToOrderId}</p>
              <p className="text-sm opacity-90">اختر المحل أو التصنيف لتكمل الإضافة</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/track/${addToOrderId}`)}
            className="px-4 py-2 bg-white text-green-700 rounded-lg font-bold text-sm hover:bg-green-50 transition"
          >
            العودة للطلب
          </button>
        </div>
      )}
      {/* Vibrant Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden border-b border-border/10">
        {/* Exact Gradient from Image #1 - Fixed for Dark Mode with safe overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] z-0 opacity-100 dark:opacity-90" />
        <div className="absolute inset-0 bg-black/10 dark:bg-black/40 z-[1]" />

        {/* Overlapping Soft Shapes matching Image #1 */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-white/20 dark:bg-primary/20 rounded-full blur-[80px] z-[2]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#A855F7]/30 dark:bg-indigo-500/20 rounded-full blur-[100px] z-[2]"
        />
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-white/10 dark:bg-white/5 rounded-full blur-[60px] z-[2]" />

        <div className="container px-4 mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-white drop-shadow-md font-cairo">
              عايز تنجز؟ <span className="text-[#FED330]">قريبلك</span> موجود!
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-xl mx-auto font-medium">
              من "عايز أكلة حلوة" لـ "عايز سباك شاطر".. كل خدمات أسيوط الجديدة بين إيديك في ثواني.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto p-4 bg-white/30 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2.5rem] border border-slate-300 dark:border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-5 top-4 h-6 w-6 text-white/70" />
                <Input
                  className="pr-14 bg-white dark:bg-slate-950/80 border-0 h-14 text-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white rounded-[1.75rem] shadow-sm font-medium focus-visible:ring-2 focus-visible:ring-highlight"
                  placeholder="بتدور على إيه النهاردة؟"
                />
              </div>
              <Button size="lg" className="h-14 px-10 text-xl font-bold bg-[#FED330] hover:bg-[#F7B731] text-indigo-950 rounded-[1.75rem] shadow-xl shadow-yellow-500/20 border-b-4 border-yellow-600 active:border-b-2 active:translate-y-0.5 transition-all">
                يلّا بينا
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-background">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">اكتشف مدينتك</h2>
            <div className="h-1.5 w-16 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {categories.map((cat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                onClick={() => router.push(`/explore?category=${cat.name}${addToOrderId ? `&addToOrderId=${addToOrderId}` : ""}`)}
              >
                <Card className="cursor-pointer border-2 border-slate-200 dark:border-slate-700 shadow-sm rounded-[2.5rem] hover:shadow-xl hover:scale-[1.02] transition-all h-full bg-white dark:bg-slate-800">
                  <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
                    <div className={`w-20 h-20 flex items-center justify-center rounded-full ${cat.colorClass} mb-4 shadow-inner`}>
                      <cat.icon className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{cat.name}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured CTA */}
      {!currentUser || currentUser.type === "customer" ? (
        <section className="py-24 bg-background">
          <div className="container px-4 mx-auto">
            <div className="bg-slate-800 dark:bg-slate-900/60 rounded-[3rem] p-8 md:p-16 text-center text-white relative overflow-hidden shadow-2xl border border-slate-700 dark:border-slate-700">
              <div className="absolute top-0 right-0 w-80 h-80 bg-primary/30 rounded-full blur-[120px] opacity-60" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/30 rounded-full blur-[120px] opacity-60" />

              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold mb-6">صنايعي أو صاحب محل؟</h2>
                <p className="text-slate-300 dark:text-indigo-100/80 text-lg md:text-xl mb-10 leading-relaxed font-cairo">
                  انضم لأكبر منصة خدمات في أسيوط الجديدة. سجل مجاناً والموقع هيسوقلك ويجيبلك زباين لحد بابك.
                </p>
                <Button size="lg" className="h-16 px-12 text-xl font-bold bg-white text-indigo-900 hover:bg-slate-100 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95">
                  انضم كمقدم خدمة 🚀
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-24 bg-background">
          <div className="container px-4 mx-auto">
            <div className="bg-primary/20 backdrop-blur-xl rounded-[3rem] p-12 text-center border border-primary/20">
              <h2 className="text-3xl font-bold mb-4 text-primary">أهلاً بك مجدداً يا {currentUser.name.split(" ")[0]}!</h2>
              <p className="text-lg mb-8 opacity-80">أنت الآن في وضع مقدم الخدمة. يمكنك متابعة طلبات العملاء وتحديث خدماتك من لوحة التحكم.</p>
              <Button
                onClick={() => window.location.href = '/provider-dashboard'}
                size="lg"
                className="bg-primary text-white rounded-2xl px-12 h-14 font-bold"
              >
                انتقل للوحة التحكم 🚀
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
