"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, Lock, User, Loader2, Phone, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import VanillaTilt from "vanilla-tilt";

export default function UserLoginPage() {
    const router = useRouter();
    const { loginUser, registerUser, sendRegisterOtp, googleLogin, isInitialized, currentUser } = useAppStore();
    const { toast } = useToast();
    const cardRef = useRef<HTMLDivElement>(null);

    // TABS: "login" or "register" or "otp"
    const [activeTab, setActiveTab] = useState<"login" | "register" | "otp">("login");

    // Form States
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<"NOT_FOUND" | "WRONG_PASSWORD" | "OTHER" | null>(null);

    // ================= ROUTE GUARD: Redirect if already logged in =================
    useEffect(() => {
        if (!isInitialized) return;
        const qareeblakToken = localStorage.getItem('qareeblak_token');
        if (qareeblakToken && currentUser) {
            router.push('/');
        }
    }, [isInitialized, currentUser, router]);

    // ================= INITIALIZE 3D TILT EFFECT =================
    useEffect(() => {
        if (cardRef.current) {
            VanillaTilt.init(cardRef.current, {
                max: 12,
                speed: 400,
                scale: 1.03,
                transition: true,
                easing: "cubic-bezier(.03,.98,.52,.99)"
            });
        }

        return () => {
            const cardEl = cardRef.current as any;
            if (cardEl?.vanillaTilt) {
                cardEl.vanillaTilt.destroy();
            }
        };
    }, []);

    // Validation Helpers
    const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordChecks = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSymbol: /[^A-Za-z0-9]/.test(password),
    };

    const isPasswordStrong = (pass: string) =>
        pass.length >= 8 &&
        /[A-Z]/.test(pass) &&
        /[a-z]/.test(pass) &&
        /[0-9]/.test(pass) &&
        /[^A-Za-z0-9]/.test(pass);

    const isPhoneValid = (value: string) => /^\d{10,15}$/.test(value.trim());
    const isNameValid = (name: string) =>
        name.trim().split(" ").length >= 2 && /^[\u0600-\u06FFa-zA-Z\s]+$/.test(name);

    const handleGoogle = async () => {
        try {
            const result = await googleLogin();
            if (!result?.success) return;

            if (result.phoneRequired) {
                toast("تم تسجيل الدخول، برجاء تسجيل رقم الهاتف أولاً لإكمال الحساب", "success");
                router.push("/complete-phone");
                return;
            }

            toast("تم تسجيل الدخول باستخدام Google بنجاح", "success");
            router.push("/");
        } catch (e: any) {
            if (e?.code !== 'auth/popup-closed-by-user') {
                toast("حدث خطأ أثناء تسجيل الدخول", "error");
            }
        }
    };

    const handleLogin = () => {
        if (!email || !password) {
            setError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
            setErrorType("OTHER");
            return;
        }

        if (!isEmailValid(email)) {
            setError("يرجى إدخال عنوان بريد إلكتروني صحيح.");
            setErrorType("OTHER");
            return;
        }

        setIsLoading(true);
        setError(null);
        setErrorType(null);

        setTimeout(async () => {
            const result = await loginUser(email, password);
            setIsLoading(false);

            if (result) {
                toast("تم تسجيل الدخول بنجاح! نورتنا ❤️", "success");
                router.push("/");
            } else {
                setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
                setErrorType("WRONG_PASSWORD");
            }
        }, 800);
    };

    const handleRegister = async () => {
        if (!name || !email || !phone || !password) {
            setError("يرجى تعبئة جميع الحقول المطلوبة.");
            setErrorType("OTHER");
            return;
        }

        if (!isNameValid(name)) {
            setError("يرجى كتابة الاسم الثلاثي بشكل صحيح (حروف فقط).");
            setErrorType("OTHER");
            return;
        }

        if (!isEmailValid(email)) {
            setError("يرجى إدخال بريد إلكتروني صالح.");
            setErrorType("OTHER");
            return;
        }

        if (!isPhoneValid(phone)) {
            setError("رقم الهاتف يجب أن يكون من 10 إلى 15 رقم.");
            setErrorType("OTHER");
            return;
        }

        if (!isPasswordStrong(password)) {
            setError("كلمة المرور لا تستوفي كل الشروط المطلوبة.");
            setErrorType("OTHER");
            return;
        }

        setIsLoading(true);
        setError(null);
        
        const success = await sendRegisterOtp(email);
        setIsLoading(false);

        if (success) {
            setActiveTab("otp");
            toast("تم إرسال رمز التحقق إلى بريدك الإلكتروني", "success");
        } else {
            setError("البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول");
            setErrorType("OTHER");
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) {
             setError("يرجى إدخال رمز تحقق صحيح");
             setErrorType("OTHER");
             return;
        }

        setIsLoading(true);
        setError(null);

        const success = await registerUser(name, email, password, phone, otp);
        setIsLoading(false);

        if (success) {
            toast("أهلاً بك في عائلة قريبلك! 🚀\nتم إنشاء حسابك بنجاح.", "success");
            router.push("/");
        } else {
            setError("رمز التحقق غير صحيح أو منتهي الصلاحية.");
            setErrorType("OTHER");
        }
    };

    const handleResendOtp = async () => {
        setIsLoading(true);
        const success = await sendRegisterOtp(email);
        setIsLoading(false);
        if (success) {
             toast("تم إعادة إرسال الرمز بنجاح!", "success");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
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

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
                ref={cardRef}
                style={{
                    transformStyle: "preserve-3d",
                    perspective: "1000px",
                } as React.CSSProperties}
            >
                <Card className="w-full shadow-2xl border-white/40 dark:border-white/10 bg-gradient-to-br from-white/90 to-white/70 dark:from-slate-900/60 dark:to-slate-800/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden relative before:absolute before:inset-0 before:rounded-[2.5rem] before:bg-gradient-to-br before:from-primary/5 before:via-transparent before:to-secondary/5 before:opacity-0 before:hover:opacity-100 before:transition-opacity before:duration-300">
                    <div className="p-6 pb-2 flex justify-end relative z-20">
                        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-cairo font-bold">
                            الرجوع للرئيسية
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <CardHeader className="text-center space-y-2 pb-6 pt-4 relative z-20">
                        <div className="flex justify-center mb-3">
                            <img 
                                src="/Qareeblak_Logo_rbg.png?v=20260321" 
                                alt="قريبلك" 
                                width={48}
                                height={48}
                                className="w-12 h-12 object-contain drop-shadow-lg"
                            />
                        </div>
                        <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-400 tracking-tight font-cairo">
                            قريبلك
                        </div>
                        <CardDescription className="text-muted-foreground font-cairo font-medium">
                            بوابتك لكل خدمات أسيوط الجديدة
                        </CardDescription>
                    </CardHeader>

                    {/* Custom Tabs Header */}
                    {activeTab !== "otp" && (
                    <div className="flex border-b border-border/50 mb-6 mx-8 relative z-20">
                        <button
                            onClick={() => { setActiveTab("login"); setError(null); }}
                            className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 font-cairo ${activeTab === "login"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            تسجيل الدخول
                        </button>
                        <button
                            onClick={() => { setActiveTab("register"); setError(null); }}
                            className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 font-cairo ${activeTab === "register"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            إنشاء حساب جديد
                        </button>
                    </div>
                    )}

                    <CardContent className="space-y-6 px-8 pb-8 relative z-20">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: activeTab === "login" ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: activeTab === "login" ? 20 : -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                {/* Error Message */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className={`rounded-xl p-4 text-sm flex items-start gap-3 border font-cairo ${errorType === "NOT_FOUND"
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : "bg-destructive/10 text-destructive border-destructive/20"
                                                }`}
                                        >
                                            {errorType === "NOT_FOUND" ? (
                                                <div className="flex flex-col gap-2 w-full">
                                                    <span className="font-bold text-base">الحساب غير موجود</span>
                                                    <span className="text-xs opacity-90">يبدو أنك لم تقم بالتسجيل معنا بعد.</span>
                                                    <Button
                                                        onClick={() => { setActiveTab("register"); setError(null); }}
                                                        className="text-xs h-8 bg-primary text-white w-fit px-4 rounded-lg mt-1 hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                                                    >
                                                        إنشاء حساب جديد
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="font-bold">{error}</span>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Common Inputs */}
                                {(activeTab === "login" || activeTab === "register") && (
                                   <>
                                {activeTab === "register" && (
                                    <div className="space-y-2 text-right">
                                        <Label className="text-sm font-bold text-foreground/80 mr-1">الاسم بالكامل</Label>
                                        <div className="relative">
                                            <User className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                className="pr-10 h-12 rounded-xl bg-background border-border/50 text-foreground text-right transition-all duration-200 hover:border-primary/50 focus:border-primary focus:shadow-lg focus:shadow-primary/20 relative group after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-primary/0 after:via-primary/10 after:to-primary/0 after:opacity-0 after:group-focus-within:opacity-100 after:transition-opacity after:duration-300"
                                                placeholder="أحمد محمد"
                                                value={name}
                                                onChange={(e) => { setName(e.target.value); setError(null); }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeTab === "register" && (
                                    <div className="space-y-2 text-right">
                                        <Label className="text-sm font-bold text-foreground/80 mr-1">رقم التليفون</Label>
                                        <div className="relative">
                                            <Phone className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                className="pr-10 h-12 rounded-xl bg-background border-border/50 text-foreground text-right transition-all duration-200 hover:border-primary/50 focus:border-primary focus:shadow-lg focus:shadow-primary/20 relative group after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-primary/0 after:via-primary/10 after:to-primary/0 after:opacity-0 after:group-focus-within:opacity-100 after:transition-opacity after:duration-300"
                                                placeholder="01012345678"
                                                value={phone}
                                                onChange={(e) => {
                                                    setPhone(e.target.value.replace(/\s+/g, ""));
                                                    setError(null);
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 text-right">
                                    <Label className="text-sm font-bold text-foreground/80 mr-1">البريد الإلكتروني</Label>
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pr-10 h-12 rounded-xl bg-background border-border/50 text-foreground text-right transition-all duration-200 hover:border-primary/50 focus:border-primary focus:shadow-lg focus:shadow-primary/20 relative group after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-primary/0 after:via-primary/10 after:to-primary/0 after:opacity-0 after:group-focus-within:opacity-100 after:transition-opacity after:duration-300"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 text-right">
                                    <Label className="text-sm font-bold text-foreground/80 mr-1">كلمة المرور</Label>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                                        <PasswordInput
                                            className="pr-10 h-12 rounded-xl bg-background border-border/50 text-foreground text-right transition-all duration-200 hover:border-primary/50 focus:border-primary focus:shadow-lg focus:shadow-primary/20 relative group after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-primary/0 after:via-primary/10 after:to-primary/0 after:opacity-0 after:group-focus-within:opacity-100 after:transition-opacity after:duration-300"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                        />
                                    </div>

                                    {activeTab === "register" && (
                                        <div className="rounded-xl border border-border/50 bg-background/70 p-3 mt-2 space-y-1.5 text-xs font-cairo text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className={passwordChecks.minLength ? "text-emerald-500" : "text-muted-foreground"}>8 أحرف على الأقل</span>
                                                {passwordChecks.minLength ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 border rounded-full border-muted-foreground/30" />}
                                            </div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className={passwordChecks.hasUpper ? "text-emerald-500" : "text-muted-foreground"}>حرف كبير (A-Z)</span>
                                                {passwordChecks.hasUpper ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 border rounded-full border-muted-foreground/30" />}
                                            </div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className={passwordChecks.hasLower ? "text-emerald-500" : "text-muted-foreground"}>حرف صغير (a-z)</span>
                                                {passwordChecks.hasLower ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 border rounded-full border-muted-foreground/30" />}
                                            </div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className={passwordChecks.hasNumber ? "text-emerald-500" : "text-muted-foreground"}>رقم (0-9)</span>
                                                {passwordChecks.hasNumber ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 border rounded-full border-muted-foreground/30" />}
                                            </div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className={passwordChecks.hasSymbol ? "text-emerald-500" : "text-muted-foreground"}>رمز خاص (!@#$...)</span>
                                                {passwordChecks.hasSymbol ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5 border rounded-full border-muted-foreground/30" />}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                <Button
                                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-lg h-14 rounded-2xl shadow-lg shadow-primary/30 transition-all active:scale-95 font-bold font-cairo mt-2 relative overflow-hidden group"
                                    onClick={activeTab === "login" ? handleLogin : handleRegister}
                                    disabled={isLoading}
                                >
                                    <span className="relative z-10">{isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
                                        activeTab === "login" ? "دخول" : "متابعة وإنشاء حساب"
                                    )}</span>
                                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                </Button>

                                {/* Divider */}
                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-4 text-muted-foreground font-bold">أو</span></div>
                                </div>

                                {/* Google Button */}
                                <Button
                                    variant="outline"
                                    className="w-full gap-3 h-14 rounded-2xl border-border/50 hover:bg-muted/50 transition-all font-bold font-cairo relative overflow-hidden group"
                                    onClick={handleGoogle}
                                    disabled={isLoading}
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    {activeTab === "login" ? "الدخول باستخدام Google" : "التسجيل باستخدام Google"}
                                </Button>
                                </>
                                )}
                                
                                {activeTab === "otp" && (
                                    <div className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h3 className="font-bold text-xl font-cairo">تأكيد البريد الإلكتروني</h3>
                                            <p className="text-muted-foreground text-sm font-cairo">
                                                تم إرسال رمز تحقق إلى <span dir="ltr" className="inline-block text-primary mx-1">{email}</span>
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-2 text-right">
                                            <Label className="text-sm font-bold text-foreground/80 mr-1">رمز التحقق</Label>
                                            <Input
                                                className="h-14 rounded-2xl bg-background border-border/50 text-foreground text-center text-2xl tracking-[0.5em] font-bold transition-all duration-200 hover:border-primary/50 focus:border-primary focus:shadow-lg focus:shadow-primary/20"
                                                placeholder="123456"
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => {
                                                    setOtp(e.target.value.replace(/\D/g, ""));
                                                    setError(null);
                                                }}
                                            />
                                        </div>
                                        
                                        <div className="flex gap-3">
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-lg h-14 rounded-2xl shadow-lg shadow-primary/30 transition-all active:scale-95 font-bold font-cairo relative overflow-hidden group"
                                                onClick={handleVerifyOtp}
                                                disabled={isLoading || otp.length < 4}
                                            >
                                                <span className="relative z-10">{isLoading ? <Loader2 className="animate-spin mx-auto" /> : "تأكيد وإنشاء الحساب"}</span>
                                                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                            </Button>
                                        </div>
                                        
                                        <div className="text-center">
                                           <Button 
                                              variant="link" 
                                              className="text-primary font-cairo text-sm mt-2" 
                                              onClick={handleResendOtp}
                                              disabled={isLoading}
                                           >
                                              لم يصلك الرمز؟ إعادة إرسال الرمز
                                           </Button>
                                        </div>
                                        
                                        <div className="text-center mt-2">
                                           <Button 
                                              variant="ghost" 
                                              className="text-muted-foreground font-cairo text-sm hover:text-foreground" 
                                              onClick={() => setActiveTab("register")}
                                              disabled={isLoading}
                                           >
                                              رجوع لتعديل البيانات
                                           </Button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </CardContent>
                </Card>

                <div className="text-center mt-8 text-sm text-muted-foreground font-cairo">
                    محمي بواسطة <Link href="/privacy" className="underline hover:text-primary transition-colors">سياسة الخصوصية</Link> و <Link href="/terms" className="underline hover:text-primary transition-colors">شروط الخدمة</Link>
                </div>
            </motion.div>
        </div>
    );
}
