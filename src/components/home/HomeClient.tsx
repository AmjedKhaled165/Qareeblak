"use client";

import { Hero3DCanvas } from "@/components/animations/Hero3DCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Wrench, Utensils, Pill, Car, Zap, Home, ShoppingBag, ShieldCheck, Star, Clock, CheckCircle2, ChevronLeft, Phone, Store } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function HomeClient() {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToOrderId = searchParams.get('addToOrderId');
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentUser?.type === 'provider') {
      router.replace('/provider-dashboard');
    }
  }, [currentUser, router]);

  if (currentUser?.type === 'provider') return null;

  const goToExplore = (overrides?: { query?: string }) => {
    const params = new URLSearchParams();
    const q = (overrides?.query ?? searchQuery).trim();
    if (q) params.set('q', q);
    if (addToOrderId) params.set('addToOrderId', addToOrderId);
    const qs = params.toString();
    router.push(qs ? `/explore?${qs}` : '/explore');
  };

  const categories = [
    { name: "مطاعم وكافيهات", icon: Utensils, colorClass: "bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20" },
    { name: "صيانة وسباكة", icon: Wrench, colorClass: "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
    { name: "صيدليات", icon: Pill, colorClass: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" },
    { name: "كهرباء", icon: Zap, colorClass: "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20" },
    { name: "سيارات", icon: Car, colorClass: "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" },
    { name: "خدمات منزلية", icon: Home, colorClass: "bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20" },
  ];

  const popularSearches = ["سباك", "كهربائي", "صيدلية", "مشويات", "ونش انقاذ"];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-primary/30">

      {/* Active Order Banner */}
      {addToOrderId && (
        <div className="bg-emerald-600 text-white p-4 sticky top-0 z-[60] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">أنت الآن تضيف منتجات للطلب #{addToOrderId}</p>
              <p className="text-xs sm:text-sm text-emerald-100">اختر الخدمة أو المنتج لإضافته مباشرة لطلبك الحالي</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full sm:w-auto font-bold bg-white text-emerald-700 hover:bg-emerald-50 transition-colors rounded-xl btn-3d"
            onClick={() => router.push(`/track/${addToOrderId}`)}
          >
            إنهاء وإرسال الطلب
          </Button>
        </div>
      )}

      {/* Hero Section - Awwwards Style 3D */}
      <section className="relative pt-20 pb-24 lg:pt-36 lg:pb-40 overflow-hidden px-4 min-h-[75vh] md:min-h-[90vh] flex items-center justify-center">
        {/* Interactive 3D Background */}
        <Hero3DCanvas />
        
        {/* Abstract Background Elements for additional depth */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] rounded-full bg-primary/10 dark:bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-30 dark:opacity-10" />
        </div>

        <div className="container max-w-5xl mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="space-y-6 flex flex-col items-center"
          >
            {/* Trust Badge / Eyebrow */}
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.9 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 20 } }
              }}
              whileHover={{ scale: 1.05, rotate: 1 }}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/70 dark:bg-slate-900/70 shadow-sm border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md mb-6 font-cairo cursor-default transition-all"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">المنصة الأكبر في أسيوط الجديدة</span>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                  >
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500 drop-shadow-md" />
                  </motion.div>
                ))}
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-1">+1000 مستخدم</span>
              </div>
            </motion.div>

            <motion.div className="overflow-hidden pb-4">
              <motion.h1 
                variants={{
                  hidden: { y: "100%", opacity: 0, rotateX: -20 },
                  visible: { y: 0, opacity: 1, rotateX: 0, transition: { duration: 0.8, ease: [0.25, 1, 0.5, 1] } }
                }}
                style={{ perspective: "1000px" }}
                className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-slate-900 dark:text-white font-cairo leading-[1.15] md:leading-[1.1]"
              >
                كل خدمات مدينتك.. <br className="hidden md:block" />
                <span 
                  className="text-transparent bg-clip-text bg-gradient-to-l from-primary via-fuchsia-500 to-indigo-600 py-2 inline-block drop-shadow-sm"
                  style={{ backgroundSize: "200% auto", animation: "gradient-shift 5s linear infinite" }}
                >
                  بضغطة زر واحدة 🚀
                </span>
              </motion.h1>
            </motion.div>

            <motion.p 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.4, ease: "easeOut" } }
              }}
              className="text-lg md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium font-cairo leading-relaxed mb-8"
            >
              مش محتاج تسأل حد تاني! ابحث، قارن، واطلب أفضل الفنيين، المطاعم، والمحلات الموثوقة في أسيوط الجديدة فوراً.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="mt-8 max-w-3xl mx-auto"
          >
            <div className="relative group max-w-3xl mx-auto">
              {/* Glow effect behind search bar */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-primary via-indigo-500 to-purple-600 rounded-[2rem] blur-md opacity-20 group-hover:opacity-40 transition duration-500"></div>

              <div className="relative flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-slate-900 p-2 sm:p-2 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 transition-all">
                <div className="relative w-full flex-1 flex items-center">
                  <Search className="absolute right-5 w-6 h-6 text-primary/60" />
                  <Input
                    className="w-full pl-6 pr-14 bg-transparent border-none text-lg shadow-none focus-visible:ring-0 placeholder:text-slate-400 text-slate-900 dark:text-white h-14 md:h-16 font-cairo rounded-[2rem]"
                    placeholder="بتدور على إيه؟ (مثال: سباك، بيتزا...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') goToExplore();
                    }}
                  />
                </div>
                <Button
                  onClick={() => goToExplore()}
                  className="w-full sm:w-auto h-14 md:h-16 px-10 text-lg font-bold rounded-[1.5rem] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white shadow-lg shadow-primary/30 transition-transform active:scale-95 font-cairo shrink-0 btn-3d"
                >
                  ابحث الآن
                </Button>
              </div>
            </div>

            {/* Popular Searches */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500 font-cairo font-bold">
              <span>شائع الآن:</span>
              {popularSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => goToExplore({ query: term })}
                  className="px-4 py-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 pop-hover"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Signals Section - Professional SaaS Style */}
      <section className="py-24 border-y border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg relative overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 pointer-events-none opacity-20">
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" />
        </div>

        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { icon: ShieldCheck, title: "مقدمي خدمة موثوقين", desc: "نراجع هويات جميع المزودين لضمان مستوى الأمان العالي.", color: "blue" },
              { icon: Star, title: "تقييمات حقيقية 100%", desc: "قراراتك معتمدة على تجارب تقييمات عملاء حقيقيين فقط.", color: "yellow" },
              { icon: Clock, title: "تواصل سريع ومباشر", desc: "توصل للمزود واتفق معاه بضغطة زر وبدون عمولات خارجية.", color: "emerald" }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
                viewport={{ once: true }}
                className="flex flex-col items-center space-y-5 p-6 rounded-[2rem] hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group card-hover"
              >
                <div className={`w-20 h-20 bg-${feature.color}-500/10 text-${feature.color}-600 dark:text-${feature.color}-400 rounded-3xl flex items-center justify-center shadow-sm border border-${feature.color}-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                  <feature.icon className="w-10 h-10" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-cairo leading-tight">{feature.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-cairo font-medium text-lg leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-950">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-4 font-cairo text-slate-900 dark:text-white">كيف يعمل قريبلك؟</h2>
          <p className="text-base text-slate-500 mb-12 font-cairo max-w-xl mx-auto font-medium">خطوات بسيطة وسريعة لتنفيذ طلبك بأمان.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />

            {[
              { step: 1, title: "ابحث عن ما تحتاجه", desc: "استخدم محرك البحث أو الأقسام.", icon: Search },
              { step: 2, title: "قارن واختر براحتك", desc: "اقرأ تقييمات العملاء واختر الأفضل.", icon: CheckCircle2 },
              { step: 3, title: "تواصل في ثواني", desc: "تواصل مباشر هاتفياً أو أونلاين.", icon: Phone }
            ].map((item, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                key={i}
                className="relative z-10 flex flex-col items-center group"
              >
                <div className="w-24 h-24 bg-white dark:bg-slate-900 border-[8px] border-slate-50 dark:border-slate-950 shadow-xl rounded-[2.5rem] flex items-center justify-center mb-6 relative group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 card-hover">
                  <item.icon className="w-10 h-10 text-primary" />
                  <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-[0_4px_15px_rgba(79,70,229,0.4)] font-cairo z-20 btn-3d">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 font-cairo text-slate-900 dark:text-white">{item.title}</h3>
                <p className="text-slate-500 font-cairo text-base px-2 font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Grid (Enhanced SaaS Style) */}
      <section className="py-24 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 relative z-10">
        {/* Soft Background Mesh Dots */}
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />
        
        <div className="container max-w-[1400px] mx-auto px-4 relative">
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
            <div className="text-center md:text-right max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-slate-900 dark:text-white font-cairo tracking-tight">استكشف الخدمات والتصنيفات</h2>
              <p className="text-slate-500 text-xl font-cairo font-medium">كل ما تحتاجه من خدمات في مكان واحد بضغطة زر</p>
            </div>
            <Link href="/explore">
              <Button variant="outline" className="h-14 px-8 rounded-2xl font-cairo font-bold hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-lg transition-all active:scale-95 group pop-hover">
                تصفح جميع الخدمات <ChevronLeft className="w-5 h-5 mr-1 group-hover:translate-x-[-4px] transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
            {categories.map((cat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                whileHover={{ y: -12 }}
                className="h-full"
              >
                <Link href={`/explore?category=${cat.name}${addToOrderId ? `&addToOrderId=${addToOrderId}` : ""}`} className="block h-full group">
                  <div className={`relative p-5 sm:p-8 md:p-10 rounded-[2.5rem] border-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg transition-all duration-500 h-full flex flex-col items-center justify-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-2xl border-slate-100 dark:border-slate-800 hover:border-primary/40 dark:hover:border-primary/40 group-hover:bg-white dark:group-hover:bg-slate-900 card-hover`}>
                    
                    {/* Floating Orb behind icon on hover */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className={`w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-3xl bg-white dark:bg-slate-950 shadow-md mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 relative z-10 border border-slate-100 dark:border-slate-800`}>
                      <cat.icon className="h-10 w-10 md:h-12 md:w-12 text-primary" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xl md:text-2xl font-cairo leading-tight relative z-10">{cat.name}</h3>
                    
                    {/* Hover Glow line at the bottom */}
                    <div className="absolute bottom-6 w-12 h-1 bg-primary/40 rounded-full opacity-0 group-hover:opacity-100 group-hover:w-20 transition-all duration-500" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 🎡 Wheel of Fortune Pulse CTA */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-indigo-600 to-primary rounded-[3rem] p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative shadow-2xl"
          >
            {/* Glowing background effect */}
            <div className="absolute top-0 right-0 w-full h-full bg-[url('/grid.svg')] opacity-20" />
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-yellow-400/30 rounded-full blur-[100px]" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-400/30 rounded-full blur-[100px]" />

            <div className="text-center md:text-right relative z-10 flex-1 space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-white font-cairo leading-tight">جرب حظك واكسب خصومات! 🎁</h2>
              <p className="text-indigo-100/90 text-sm md:text-base font-cairo max-w-lg font-medium">لف العجلة مرة كل يوم واكسب جوايز فوريّة تبدأ بيها طلبك القادم.</p>
            </div>

            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 shrink-0 mt-6 md:mt-0"
            >
              <Link href="/wheel">
                <Button
                  className="bg-[#FED330] hover:bg-[#F7B731] text-indigo-950 font-bold text-lg px-8 h-12 rounded-xl shadow-[0_4px_15px_rgba(254,211,48,0.4)] active:scale-95 transition-all font-cairo border-b-2 border-yellow-600 active:border-b-0 active:translate-y-px btn-3d"
                >
                  العب الآن 🎡
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured CTA for Providers (Edge-to-Edge Premium Design) */}
      {!currentUser || currentUser.type === "customer" ? (
        <section className="py-20 relative overflow-hidden bg-gradient-to-b from-slate-50 to-indigo-50/50 dark:from-slate-950 dark:to-indigo-950/20 border-t items-center flex border-slate-200 dark:border-slate-800">
          {/* Edge-to-Edge Background Accents */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-[120px]" />

          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
              
              {/* Text & Call to Action (Right Side) */}
              <div className="flex-1 w-full text-center lg:text-right space-y-6 z-10 mt-8 lg:mt-0">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 font-bold text-sm shadow-sm border border-slate-200 dark:border-slate-800">
                  <Store className="w-4 h-4" />
                  انضم لشركاء منصة قريبلك
                </div>
                
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black font-cairo text-slate-900 dark:text-white leading-[1.2]">
                  أنت صنايعي أو عندك 
                  <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400">
                    نشاط تجاري؟
                  </span>
                </h2>
                
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 font-cairo leading-relaxed max-w-lg mx-auto lg:mx-0">
                  ضاعف مبيعاتك واوصل لآلاف العملاء في أسيوط الجديدة. منصة قريبلك بتقدملك لوحة تحكم كاملة، إدارة طلبات، وتقييمات ترفع مصداقيتك.
                </p>
                
                <div className="pt-2 flex justify-center lg:justify-start">
                  <Button
                    onClick={() => router.push('/join')}
                    className="h-14 px-10 text-xl font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-1 font-cairo btn-3d"
                  >
                    سجل حسابك مجاناً 🚀
                  </Button>
                </div>
              </div>

              {/* Creative Floating UI Elements (Left Side) */}
              <div className="flex-1 w-full relative h-[280px] sm:h-[350px] md:h-[400px] z-10 flex items-center justify-center">
                {/* Glowing backdrop circle */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-400 rounded-full blur-[80px] opacity-10 dark:opacity-20 animate-pulse" />
                
                {/* Floating Mockup Card 1 */}
                <div 
                  className="absolute top-[10%] left-[5%] sm:left-[10%] md:left-[20%] w-[220px] sm:w-[260px] md:w-[320px] bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-indigo-500/10 border border-slate-100 dark:border-slate-700 z-20 card-hover"
                  style={{ animation: "float-y 4s ease-in-out infinite", willChange: "transform" }}
                >
                  <div className="flex gap-4 items-center mb-4">
                    <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                      <Utensils className="w-7 h-7 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 font-cairo text-lg">مطعم البيتزا اللذيذة</div>
                      <div className="flex items-center gap-1 text-sm text-yellow-500 mt-1">
                        <Star className="w-4 h-4 fill-current"/>
                        <Star className="w-4 h-4 fill-current"/>
                        <Star className="w-4 h-4 fill-current"/>
                        <Star className="w-4 h-4 fill-current"/>
                        <Star className="w-4 h-4 fill-current"/>
                        <span className="text-slate-500 font-cairo font-bold pr-1">4.9</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full mb-3" />
                  <div className="h-2.5 w-2/3 bg-slate-100 dark:bg-slate-700/50 rounded-full" />
                </div>

                {/* Floating Mockup Card 2 */}
                <div 
                  className="absolute bottom-[5%] right-[2%] sm:right-[5%] md:right-[10%] w-[200px] sm:w-[240px] md:w-[280px] bg-white/95 dark:bg-slate-800/95 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-violet-500/10 border border-slate-100 dark:border-slate-700 z-30 card-hover"
                  style={{ animation: "float-y 5s ease-in-out 1s infinite", animationDirection: "reverse", willChange: "transform" }}
                >
                  <div className="flex justify-between items-center mb-5">
                    <div className="text-base font-bold text-slate-800 dark:text-slate-200 font-cairo">طلب جديد 🔔</div>
                    <div className="text-emerald-500 font-bold text-lg font-cairo">250 ج.م</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full" />
                      <div className="h-2 w-1/2 bg-slate-100 dark:bg-slate-700 rounded-full" />
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400 font-cairo">
                    قبول الطلب
                  </div>
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-full -z-10 border border-slate-200/50 dark:border-slate-700/50" />
              </div>

            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
