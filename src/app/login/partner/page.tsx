"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Truck, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

export default function PartnerLoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        identifier: "",
        password: ""
    });

    useEffect(() => {
        const token = localStorage.getItem('halan_token');
        const userStr = localStorage.getItem('halan_user');

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === 'owner' || user.role === 'supervisor') {
                    router.replace('/partner/dashboard');
                } else {
                    router.replace('/partner/driver');
                }
            } catch (e) {
                localStorage.removeItem('halan_token');
                localStorage.removeItem('halan_user');
            }
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.identifier || !formData.password) {
            toast("يرجى إدخال اسم المستخدم وكلمة المرور", "error");
            return;
        }

        setIsLoading(true);
        try {
            const loginData = {
                identifier: formData.identifier.trim(),
                password: formData.password.trim()
            };

            console.log('[PartnerLogin] Attempting login with:', { identifier: loginData.identifier.substring(0, 5) + '...' });

            const data = await apiCall('/halan/auth/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            console.log('[PartnerLogin] Login response:', { success: data.success, hasToken: !!data.data?.token, userName: data.data?.user?.name });

            if (data.success && data.data?.token) {
                // Store token and user info EXPLICITLY
                const token = data.data.token;
                const user = data.data.user;

                localStorage.setItem('halan_token', token);
                localStorage.setItem('halan_user', JSON.stringify(user));

                // Verify storage
                const storedToken = localStorage.getItem('halan_token');
                const storedUser = localStorage.getItem('halan_user');

                if (!storedToken || !storedUser) {
                    console.error('[PartnerLogin] ❌ Failed to store token/user in localStorage!');
                    toast("خطأ في حفظ بيانات الجلسة. يرجى محاولة تسجيل الدخول مرة أخرى", "error");
                    return;
                }

                console.log('[PartnerLogin] ✅ Token stored successfully. Token length:', token.length);
                toast(`مرحباً ${user.name_ar}! 🎉`, "success");

                // Redirect based on role
                const role = user.role;
                console.log('[PartnerLogin] Redirecting with role:', role);
                if (role === 'owner' || role === 'supervisor') {
                    router.push('/partner/dashboard');
                } else {
                    router.push('/partner/driver');
                }
            } else {
                const errorMsg = data.error || "فشل تسجيل الدخول";
                console.error('[PartnerLogin] Login failed:', errorMsg);
                toast(errorMsg, "error");
            }
        } catch (error) {
            console.error('[PartnerLogin] Login error:', error);
            const errorMsg = error instanceof Error ? error.message : "حدث خطأ في الاتصال بالسيرفر";
            toast(errorMsg, "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-indigo-50 to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="w-20 h-20 mx-auto mb-4">
                        <img 
                            src="/Qareeblak_Logo_rbg.png?v=20260321" 
                            alt="قريبلك" 
                            width={80}
                            height={80}
                            className="w-full h-full object-contain drop-shadow-lg"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        حالاً للتوصيل
                    </h1>
                    <p className="text-slate-500">سجل دخولك للوصول للوحة التحكم</p>
                </motion.div>

                {/* Login Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl text-center">تسجيل الدخول</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <Label htmlFor="identifier">اسم المستخدم أو الإيميل</Label>
                                    <Input
                                        id="identifier"
                                        value={formData.identifier}
                                        onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
                                        placeholder="أدخل اسم المستخدم"
                                        className="mt-1"
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="password">كلمة المرور</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="••••••••"
                                            dir="ltr"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                            جاري الدخول...
                                        </>
                                    ) : (
                                        "دخول"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-6"
                >
                    <Link href="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        العودة لاختيار نوع الحساب
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}
