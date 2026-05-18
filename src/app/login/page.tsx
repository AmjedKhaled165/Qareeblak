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
      const userType = currentUser.user_type || currentUser.type;
      console.log("Already logged in, redirecting...", userType);
      if (userType === 'provider' || userType?.includes('partner')) {
        router.replace("/provider-dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [currentUser, isLoading, router]);



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* ── CSS-Animated Blobs (GPU, zero JS overhead) ── */}
      <div className="blob-1 absolute top-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[100px] z-0 opacity-50 pointer-events-none"
        style={{ background: "linear-gradient(135deg, #3B82F6, #9333EA)" }} />
      <div className="blob-2 absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[100px] z-0 opacity-50 pointer-events-none"
        style={{ background: "linear-gradient(135deg, #A58EFB, #EAB308)" }} />
      <div className="blob-3 absolute left-[10%] top-[30%] w-64 h-64 rounded-full blur-[80px] z-0 opacity-30 pointer-events-none"
        style={{ background: "linear-gradient(135deg, #22C55E, #3B82F6)" }} />


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
          whileHover={{ y: -6 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/login/user")}
          className="flex-1 h-full"
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
              <Button className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-xl font-bold shadow-lg shadow-primary/30 mt-auto transition-all active:scale-95 relative overflow-hidden group/btn btn-3d">
                <span className="relative z-10">دخول كمستخدم</span>
                <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Unified Service Provider Card */}
        <motion.div
          whileHover={{ y: -6 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/login/provider")}
          className="flex-1 h-full"
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
        <Link href="/" className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-bold text-xl group font-cairo link-hover">
          <span className="group-hover:-translate-x-2 transition-transform">→</span>
          العودة للرئيسية
        </Link>
      </motion.div>
    </div>
  );
}

