"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/hooks/use-app-store";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Store, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ProviderLogin() {
    const router = useRouter();
    const { toast } = useToast();
    const { loginUser, currentUser } = useAppStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async () => {
        if (!email || !password) {
            setError("يرجى ملء جميع الحقول");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const success = await loginUser(email, password);

            if (success) {
                toast("أهلاً بك في لوحة تحكم الشركاء! 💼", "success");
                router.push("/provider-dashboard");
            } else {
                setError("بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.");
            }
        } catch (err) {
            setError("حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                <Card className="w-full shadow-xl border-none">
                    <CardHeader className="text-center space-y-2 relative">
                        <Link href="/login" className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                            <ArrowRight className="w-6 h-6" />
                        </Link>
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Store className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">
                            لوحة الشركاء
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            سجل دخولك لإدارة خدماتك وطلباتك
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="partner@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="text-left"
                                dir="ltr"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">كلمة المرور</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="text-left"
                                dir="ltr"
                            />
                        </div>

                        <Button
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-white"
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
                                "دخول لوحة الشركاء"
                            )}
                        </Button>

                        <div className="text-center pt-2 text-sm text-slate-500">
                            لست شريكاً بعد؟{" "}
                            <Link href="/join" className="text-orange-600 hover:underline font-medium">
                                انضم إلينا الآن
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
