"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiCall } from "@/lib/api";



export default function ProviderLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginUser, logout, isInitialized, currentUser } = useAppStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isInitialized) return;
    const qareeblakToken = localStorage.getItem('qareeblak_token');
    const halanToken = localStorage.getItem('halan_token');
    const halanUser = localStorage.getItem('halan_user');

    if (halanToken && halanUser) {
      try {
        const user = JSON.parse(halanUser);
        const role = user.role;
        if (role === 'owner') router.push('/partner/owner');
        else if (role === 'supervisor') router.push('/partner/manager');
        else if (role === 'courier') router.push('/partner/driver');
        else router.push('/partner/dashboard');
        return;
      } catch (e) { /* ignore */ }
    }
    if (qareeblakToken && currentUser) {
      router.push('/provider-dashboard');
      return;
    }
  }, [isInitialized, currentUser, router]);

  const handleLogin = async () => {
    if (!identifier || !password) { setError("يرجى ملء جميع الحقول"); return; }
    setIsLoading(true);
    setError("");
    try {
      try {
        const data = await apiCall('/halan/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password })
        });
        if (data.success && data.data?.token) {
          localStorage.setItem('halan_token', data.data.token);
          localStorage.setItem('halan_user', JSON.stringify(data.data.user));
          const storedToken = localStorage.getItem('halan_token');
          const storedUser = localStorage.getItem('halan_user');
          if (!storedToken || !storedUser) { setError("خطأ في حفظ بيانات الجلسة"); return; }
          toast(`أهلاً بك يا ${data.data.user.name_ar || 'عزيزي'} 👋`, "success");
          const role = data.data.user.role;
          if (role === 'owner') router.push('/partner/owner');
          else if (role === 'supervisor') router.push('/partner/manager');
          else if (role === 'courier') router.push('/partner/driver');
          else router.push('/partner/dashboard');
          return;
        }
      } catch (_halanErr) {
        // Fall back to regular provider login when Halan auth fails.
      }

      const success = await loginUser(identifier, password);
      if (success) {
        const userType = success.type || success.user_type;
        if (userType === 'customer') {
          logout();
          setError("هذا الحساب مسجل كعميل، الرجاء الدخول من بوابة العملاء.");
          return;
        }

        toast("أهلاً بك في لوحة تحكم مقدمي الخدمات! 💼", "success");
        router.push("/provider-dashboard");
      } else {
        setError("بيانات الدخول غير صحيحة. تأكد من اسم المستخدم/البريد الإلكتروني وكلمة المرور.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('اسم المستخدم') || message.includes('كلمة المرور')) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
      } else {
        setError("حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-slate-400 font-cairo">جاري التحقق من الجلسة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-cairo transition-colors duration-500">

      {/* ── CSS-Animated Blobs (GPU) ── */}
      <div className="blob-1 absolute top-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="blob-2 absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-900/10 blur-[150px] pointer-events-none" />

      {/* ===== MAIN CARD ===== */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <div className="w-full rounded-[2.5rem] overflow-hidden border border-border/50 bg-gradient-to-br from-white/90 to-white/70 dark:from-slate-900/80 dark:to-slate-800/60 backdrop-blur-2xl shadow-2xl shadow-primary/10 dark:shadow-indigo-900/30">
            {/* Card top glow line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

            {/* Header */}
            <div className="p-8 pb-6 text-center relative">
            <Link href="/login" className="absolute right-6 top-6 w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all pop-hover border border-border/30">
                <ArrowRight className="w-5 h-5" />
              </Link>

              {/* Logo with 3D glow */}
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto w-24 h-24 mb-6 relative"
              >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl scale-125 animate-pulse" />
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                  <img
                    src="/Qareeblak_Logo_rbg.png?v=20260327"
                    alt="قريبلك"
                    width={60}
                    height={60}
                    className="object-contain drop-shadow-xl"
                  />
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black text-slate-900 dark:text-white mb-2"
              >
                بوابة مقدمي الخدمة
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-500 dark:text-slate-400 text-sm font-medium"
              >
                سجل دخولك لإدارة الطلبات والخدمات
              </motion.p>

              {/* Provider type badges */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-3 mt-5"
              >
                {[
                  { label: "أصحاب المحلات", color: "indigo" },
                  { label: "الكوريرات", color: "violet" },
                  { label: "المشرفين", color: "orange" },
                ].map((b) => (
                  <span
                    key={b.label}
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      b.color === "indigo" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30" :
                      b.color === "violet" ? "bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/30" :
                      "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30"
                    }`}
                  >
                    {b.label}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Form */}
            <div className="px-8 pb-8 space-y-5">
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="p-4 bg-red-500/10 text-red-400 text-sm rounded-2xl border border-red-500/20 text-center font-bold"
                >
                  ⚠️ {error}
                </motion.div>
              )}

              {/* Identifier Field */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-2 text-right"
              >
                <Label htmlFor="identifier" className="text-sm font-bold text-slate-700 dark:text-slate-300 mr-1">
                  اسم المستخدم أو البريد الإلكتروني
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="username / user@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-14 rounded-2xl bg-background dark:bg-white/5 border-border dark:border-white/10 text-foreground dark:text-white placeholder:text-slate-400 focus:border-primary transition-all text-left text-sm"
                  dir="ltr"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="space-y-2 text-right"
              >
                <Label htmlFor="password" className="text-sm font-bold text-slate-700 dark:text-slate-300 mr-1">
                  كلمة المرور
                </Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-2xl bg-background dark:bg-white/5 border-border dark:border-white/10 text-foreground dark:text-white placeholder:text-slate-400 focus:border-primary transition-all text-left text-sm"
                  dir="ltr"
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleLogin()}
                />
              </motion.div>

              {/* Login Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <Button
                  className="w-full h-14 rounded-2xl text-white text-lg font-black shadow-2xl shadow-indigo-500/30 transition-all active:scale-[0.97] mt-2 btn-3d border-0"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #4F46E5 100%)",
                    backgroundSize: "200% auto",
                  }}
                  size="lg"
                  onClick={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الدخول...
                    </>
                  ) : (
                    "تسجيل الدخول 🔐"
                  )}
                </Button>
              </motion.div>

              {/* Bottom link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="text-center pt-2 text-sm text-slate-500"
              >
                لست شريكاً بعد؟{" "}
                <Link href="/join" className="text-primary hover:text-primary/80 font-bold transition-colors link-hover">
                  انضم إلينا الآن
                </Link>
              </motion.div>
            </div>

          </div>
        </motion.div>

    </div>
  );
}
