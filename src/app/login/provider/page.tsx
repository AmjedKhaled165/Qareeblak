"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Store, Loader2, Truck, Briefcase } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiCall } from "@/lib/api";
import { useEffect } from "react";

export default function ProviderLogin() {
    const router = useRouter();
    const { toast } = useToast();
    const { loginUser, isInitialized, currentUser } = useAppStore();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // ================= ROUTE GUARD: Redirect if already logged in =================
    useEffect(() => {
        // Wait for app to initialize
        if (!isInitialized) return;

        const qareeblakToken = localStorage.getItem('qareeblak_token');
        const halanToken = localStorage.getItem('halan_token');
        const halanUser = localStorage.getItem('halan_user');

        // If Halan user is logged in, redirect to appropriate dashboard
        if (halanToken && halanUser) {
            try {
                const user = JSON.parse(halanUser);
                const role = user.role;
                console.log('[ProviderLogin] Halan user already logged in. Redirecting to dashboard.');

                if (role === 'owner') router.push('/partner/owner');
                else if (role === 'supervisor') router.push('/partner/manager');
                else if (role === 'courier') router.push('/partner/driver');
                else router.push('/partner/dashboard');
                return;
            } catch (e) {
                console.error('Failed to parse halan user');
            }
        }

        // If regular provider is logged in (via Qareeblak), redirect to provider dashboard
        if (qareeblakToken && currentUser) {
            console.log('[ProviderLogin] Provider already logged in. Redirecting to dashboard.');
            router.push('/provider-dashboard');
            return;
        }
    }, [isInitialized, currentUser, router]);

    const handleLogin = async () => {
        if (!identifier || !password) {
            setError("يرجى ملء جميع الحقول");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            // 1. Try Halan Login (Partner/Courier/Supervisor/Owner)
            // We use direct fetch here to avoid the AppStore wrapper which is designed for regular users
            const data = await apiCall('/halan/auth/login', {
                method: 'POST',
                body: JSON.stringify({ identifier, password })
            });
            console.log('[ProviderLogin] Halan response success:', data.success, 'hasToken:', !!data.data?.token);

            if (data.success && data.data?.token) {
                // Save Halan specific data
                localStorage.setItem('halan_token', data.data.token);
                localStorage.setItem('halan_user', JSON.stringify(data.data.user));

                    // Verify storage
                    const storedToken = localStorage.getItem('halan_token');
                    const storedUser = localStorage.getItem('halan_user');

                if (!storedToken || !storedUser) {
                    console.error('[ProviderLogin] ❌ Failed to store Halan credentials!');
                    setError("خطأ في حفظ بيانات الجلسة");
                    return;
                }

                console.log('[ProviderLogin] ✅ Halan token stored, redirecting...');
                toast(`أهلاً بك يا ${data.data.user.name_ar || 'عزيزي'} 👋`, "success");

                // Redirect based on role
                const role = data.data.user.role;
                if (role === 'owner') router.push('/partner/owner');
                else if (role === 'supervisor') router.push('/partner/manager');
                else if (role === 'courier') router.push('/partner/driver');
                else router.push('/partner/dashboard'); // Fallback
                return;
            }

            console.log('[ProviderLogin] Halan login failed, trying regular provider login...');

            // 2. Fallback to Regular Provider Login (Shops/Services)
            // If Halan login failed, maybe they are a regular provider
            // The identifier for regular providers is usually email, but we pass whatever user typed
            const success = await loginUser(identifier, password); // Note: loginUser expects 'email', but let's see if backend handles username

            if (success) {
                toast("أهلاً بك في لوحة تحكم مقدمي الخدمات! 💼", "success");
                router.push("/provider-dashboard");
            } else {
                setError("بيانات الدخول غير صحيحة. تأكد من اسم المستخدم/البريد الإلكتروني وكلمة المرور.");
            }

        } catch (err) {
            console.error('[ProviderLogin] Error:', err);
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

    // ================= LOADING STATE: Prevent flicker =================
    if (!isInitialized) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground font-cairo">جاري التحقق من الجلسة...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-[100px] z-0" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <Card className="w-full shadow-2xl border-border/50 bg-card rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="text-center space-y-4 relative p-8">
                        <Link href="/login" className="absolute right-6 top-6 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowRight className="w-6 h-6" />
                        </Link>
                        <div className="mx-auto w-20 h-20">
                            <img 
                                src="/qareeblak-logo-cropped.png?v=20260318" 
                                alt="قريبلك" 
                                width={80}
                                height={80}
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold text-foreground font-cairo">
                                بوابة مقدمي الخدمة
                            </CardTitle>
                            <CardDescription className="text-muted-foreground text-sm">
                                سجل دخولك لإدارة الطلبات والخدمات
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-0 space-y-6">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20 text-center font-bold font-cairo"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-2 text-right">
                            <Label htmlFor="identifier" className="text-sm font-bold text-foreground/80 mr-1">اسم المستخدم أو البريد الإلكتروني</Label>
                            <Input
                                id="identifier"
                                type="text"
                                placeholder="username / user@example.com"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="h-12 rounded-xl bg-background border-border/50 text-foreground text-left"
                                dir="ltr"
                            />
                        </div>

                        <div className="space-y-2 text-right">
                            <Label htmlFor="password" className="text-sm font-bold text-foreground/80 mr-1">كلمة المرور</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl bg-background border-border/50 text-foreground text-left"
                                dir="ltr"
                            />
                        </div>

                        <Button
                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white text-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 mt-2"
                            size="lg"
                            onClick={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    جاري الدخول...
                                </>
                            ) : (
                                "تسجيل الدخول"
                            )}
                        </Button>

                        <div className="text-center pt-2 text-sm text-muted-foreground">
                            لست شريكاً بعد؟{" "}
                            <Link href="/join" className="text-primary hover:underline font-bold">
                                انضم إلينا الآن
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
