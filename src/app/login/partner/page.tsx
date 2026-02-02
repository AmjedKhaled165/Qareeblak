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
import { useToast } from "@/providers/toast-provider";
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

            const data = await apiCall('/halan/auth/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            if (data.success) {
                // Store token and user info
                localStorage.setItem('halan_token', data.data.token);
                localStorage.setItem('halan_user', JSON.stringify(data.data.user));

                toast(`مرحباً ${data.data.user.name_ar}! 🎉`, "success");

                // Redirect based on role
                const role = data.data.user.role;
                if (role === 'owner' || role === 'supervisor') {
                    router.push('/partner/dashboard');
                } else {
                    router.push('/partner/driver');
                }
            } else {
                toast(data.error || "فشل تسجيل الدخول", "error");
            }
        } catch (error) {
            console.error('Login error:', error);
            toast("حدث خطأ في الاتصال بالسيرفر", "error");
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
                    <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Truck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        نظام حالاً للتوصيل
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
