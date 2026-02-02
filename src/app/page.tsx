"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Wrench, Utensils, Pill, Car, Zap, Home } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const categories = [
    { name: "مطاعم وكافيهات", icon: Utensils, color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-200" },
    { name: "صيانة وسباكة", icon: Wrench, color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-200" },
    { name: "صيدليات", icon: Pill, color: "text-green-600", bg: "bg-green-100", border: "border-green-200" },
    { name: "كهرباء", icon: Zap, color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-200" },
    { name: "سيارات", icon: Car, color: "text-red-600", bg: "bg-red-100", border: "border-red-200" },
    { name: "خدمات منزلية", icon: Home, color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-200" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Vibrant Hero Section */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        {/* Dynamic Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-primary to-purple-700 text-white z-0" />

        {/* Animated Shapes */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], x: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"
        />

        <div className="container px-4 mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-white drop-shadow-md">
              عايز تنجز؟ <span className="text-yellow-300">قريبلك</span> موجود!
            </h1>
            <p className="text-xl md:text-2xl text-purple-100 mb-10 max-w-2xl mx-auto font-light">
              من "عايز أكلة حلوة" لـ "عايز سباك شاطر".. كل خدمات أسيوط الجديدة بين إيديك في ثواني.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="max-w-2xl mx-auto flex gap-2 p-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20"
          >
            <div className="relative flex-1">
              <Search className="absolute right-4 top-3.5 h-6 w-6 text-indigo-200" />
              <Input
                className="pr-12 bg-white/90 border-0 shadow-inner h-14 text-lg placeholder:text-slate-500 text-slate-900 rounded-xl"
                placeholder="بتدور على إيه النهاردة؟ (مطاعم، صيانة...)"
              />
            </div>
            <Button size="lg" className="h-14 px-8 text-lg font-bold bg-yellow-400 hover:bg-yellow-500 text-indigo-900 rounded-xl shadow-lg shadow-yellow-500/20">
              يلّا بينا
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-slate-50 relative">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">اكتشف مدينتك</h2>
            <div className="h-1.5 w-24 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((cat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <Card className={`cursor-pointer border-2 ${cat.border} shadow-sm hover:shadow-xl transition-all h-full group bg-white`}>
                  <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
                    <div className={`p-5 rounded-full ${cat.bg} mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                      <cat.icon className={`h-8 w-8 ${cat.color}`} />
                    </div>
                    <h3 className="font-bold text-slate-700 text-lg group-hover:text-primary transition-colors">{cat.name}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured CTA */}
      <section className="py-24 bg-white">
        <div className="container px-4 mx-auto">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-[100px] opacity-50" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary rounded-full blur-[100px] opacity-50" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">صنايعي أو صاحب محل؟</h2>
              <p className="text-slate-300 text-lg md:text-xl mb-8 leading-relaxed">
                انضم لأكبر منصة خدمات في أسيوط الجديدة. سجل مجاناً والموقع هيسوقلك ويجيبلك زباين لحد بابك.
              </p>
              <Button size="lg" className="h-14 px-10 text-lg font-bold bg-white text-slate-900 hover:bg-slate-100 rounded-full">
                انضم كمقدم خدمة 🚀
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
