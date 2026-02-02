"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/hooks/use-app-store";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Mail, Lock, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function UserLoginPage() {
    const router = useRouter();
    const { loginUser, registerUser, googleLogin } = useAppStore();
    const { toast } = useToast();

    // TABS: "login" or "register"
    const [activeTab, setActiveTab] = useState<"login" | "register">("login");

    // Form States
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<"NOT_FOUND" | "WRONG_PASSWORD" | "OTHER" | null>(null);

    // Validation Helpers
    const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isPasswordStrong = (pass: string) => pass.length >= 8;
    const isNameValid = (name: string) => name.trim().split(" ").length >= 2 && /^[\u0600-\u06FFa-zA-Z\s]+$/.test(name);

    const handleGoogle = () => {
        setIsLoading(true);
        setTimeout(() => {
            googleLogin();
            toast("تم تسجيل الدخول باستخدام Google بنجاح", "success");
            router.push("/");
        }, 1500);
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

        setTimeout(() => {
            const result = loginUser(email, password);
            setIsLoading(false);

            if (result.success) {
                toast("تم تسجيل الدخول بنجاح! نورتنا ❤️", "success");
                router.push("/");
            } else {
                if (result.error === "NOT_FOUND") {
                    setError("هذا البريد الإلكتروني غير مسجل لدينا.");
                    setErrorType("NOT_FOUND");
                } else if (result.error === "WRONG_PASSWORD") {
                    setError("كلمة المرور غير صحيحة.");
                    setErrorType("WRONG_PASSWORD");
                } else {
                    setError("حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.");
                    setErrorType("OTHER");
                }
            }
        }, 800);
    };

    const handleRegister = () => {
        if (!name || !email || !password) {
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

        if (!isPasswordStrong(password)) {
            setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
            setErrorType("OTHER");
            return;
        }

        setIsLoading(true);
        setError(null);

        setTimeout(() => {
            const success = registerUser(name, email, password);
            setIsLoading(false);

            if (success) {
                toast("أهلاً بك في عائلة قريبلك! 🚀\nتم إنشاء حسابك بنجاح، استكشف الخدمات الآن.", "success");
                router.push("/");
            } else {
                setError("عذراً، لا يمكن إنشاء الحساب. قد يكون البريد الإلكتروني مستخدم بالفعل.");
                setErrorType("OTHER");
            }
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <Card className="w-full shadow-xl border-none overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 w-full" />
                    <div className="p-4 pb-0">
                        <Link href="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-primary transition-colors">
                            <ArrowRight className="w-4 h-4" />
                            رجوع للرئيسية
                        </Link>
                    </div>

                    <CardHeader className="text-center space-y-2 pb-6">
                        <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
                            قريبلك
                        </div>
                        <CardDescription className="text-base">
                            بوابتك لكل خدمات أسيوط الجديدة
                        </CardDescription>
                    </CardHeader>

                    {/* Custom Tabs Header */}
                    <div className="flex border-b mb-6 mx-8">
                        <button
                            onClick={() => setActiveTab("login")}
                            className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "login"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            تسجيل الدخول
                        </button>
                        <button
                            onClick={() => setActiveTab("register")}
                            className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "register"
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            إنشاء حساب جديد
                        </button>
                    </div>

                    <CardContent className="space-y-6 px-8 pb-8">
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
                                            className={`rounded-lg p-3 text-sm flex items-start gap-2 ${errorType === "NOT_FOUND" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-red-50 text-red-700 border border-red-100"
                                                }`}
                                        >
                                            {errorType === "NOT_FOUND" ? (
                                                <div className="flex flex-col gap-1 w-full">
                                                    <span className="font-bold">الحساب غير موجود</span>
                                                    <span className="text-xs opacity-90">يبدو أنك لم تقم بالتسجيل معنا بعد.</span>
                                                    <button
                                                        onClick={() => { setActiveTab("register"); setError(null); }}
                                                        className="text-xs bg-blue-600 text-white w-fit px-3 py-1 rounded-md mt-1 hover:bg-blue-700 transition"
                                                    >
                                                        إنشاء حساب جديد
                                                    </button>
                                                </div>
                                            ) : (
                                                <span>{error}</span>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Common Inputs */}
                                {activeTab === "register" && (
                                    <div className="space-y-2">
                                        <Label>الاسم بالكامل</Label>
                                        <div className="relative">
                                            <User className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pr-9"
                                                placeholder="أحمد محمد"
                                                value={name}
                                                onChange={(e) => { setName(e.target.value); setError(null); }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>البريد الإلكتروني</Label>
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="pr-9"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>كلمة المرور</Label>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="pr-9"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                        />
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-11 shadow-md hover:shadow-lg transition-all"
                                    onClick={activeTab === "login" ? handleLogin : handleRegister}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : (
                                        activeTab === "login" ? "دخول" : "تسجيل حساب"
                                    )}
                                </Button>

                                {/* Divider */}
                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">أو</span></div>
                                </div>

                                {/* Google Button */}
                                <Button variant="outline" className="w-full gap-2 h-11" onClick={handleGoogle} disabled={isLoading}>
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    {activeTab === "login" ? "الدخول باستخدام Google" : "التسجيل باستخدام Google"}
                                </Button>
                            </motion.div>
                        </AnimatePresence>
                    </CardContent>
                </Card>

                <div className="text-center mt-6 text-sm text-slate-500">
                    محمي بواسطة <Link href="#" className="underline hover:text-blue-600">سياسة الخصوصية</Link> و <Link href="#" className="underline hover:text-blue-600">شروط الخدمة</Link>
                </div>
            </motion.div>
        </div>
    );
}
