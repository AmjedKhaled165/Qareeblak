"use client";

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Clock } from "lucide-react"
import { useState } from "react"
import { authApi } from "@/lib/api"
import { useRouter } from "next/navigation"

export default function JoinPage() {
    const router = useRouter();
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        category: "",
        location: "",
        description: "",
        email: "",
        password: ""
    });

    const handleSubmit = async () => {
        if (!formData.name || !formData.phone || !formData.email || !formData.password || !formData.category) {
            setError("يرجى ملء جميع الحقول المطلوبة");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            await authApi.submitProviderRequest({
                name: formData.name,
                phone: formData.phone,
                category: formData.category,
                location: formData.location,
                email: formData.email,
                password: formData.password
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || "حدث خطأ في تسجيل الطلب. يرجى المحاولة مرة أخرى.");
        } finally {
            setIsLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] z-0" />
                <Card className="max-w-md w-full text-center p-10 border-border/50 bg-card rounded-[2.5rem] shadow-2xl relative z-10">
                    <div className="w-24 h-24 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Clock className="h-12 w-12 text-secondary" />
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-3 font-cairo">تم استلام طلبك!</h2>
                    <p className="text-muted-foreground mb-6 text-lg">
                        شكراً لانضمامك إلينا يا <strong className="text-foreground">{formData.name}</strong>.
                    </p>
                    <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6 text-base text-secondary/80 mb-8 leading-relaxed font-medium">
                        سيقوم فريقنا بمراجعة طلبك والتواصل معك قريباً.
                        <br />
                        بعد الموافقة، يمكنك تسجيل الدخول باستخدام بريدك الإلكتروني.
                    </div>
                    <Button size="lg" onClick={() => router.push("/")} className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-95">
                        العودة للرئيسية
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 relative overflow-hidden font-cairo">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 max-w-4xl relative z-10">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 font-bold text-sm mb-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                        🚀 سجل حسابك مجاناً وبدون أي رسوم
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black mb-4 text-slate-900 dark:text-white tracking-tight">انضم لشركاء النجاح</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                        هل تقدم خدمة مميزة؟ سجل معنا الآن واوصل لآلاف العملاء في أسيوط الجديدة. منصتنا هتوفرلك لوحة تحكم كاملة لإدارة عملك.
                    </p>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
                        
                        {/* Side Panel (Hidden on small screens) */}
                        <div className="hidden lg:block lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://pattern.jessetylermarx.com/pattern-9.svg')] opacity-10" />
                            <div className="relative z-10 h-full flex flex-col justify-center">
                                <h3 className="text-3xl font-black mb-6 leading-tight">كبّر شغلك <br/> وضعّف مبيعاتك</h3>
                                <ul className="space-y-6">
                                    <li className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                            <span className="text-xl">📈</span>
                                        </div>
                                        <div className="font-bold">وصول لآلاف العملاء يومياً</div>
                                    </li>
                                    <li className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                            <span className="text-xl">💻</span>
                                        </div>
                                        <div className="font-bold">لوحة تحكم ذكية ومجانية</div>
                                    </li>
                                    <li className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                            <span className="text-xl">⭐️</span>
                                        </div>
                                        <div className="font-bold">تقييمات ترفع مصداقيتك</div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Form Panel */}
                        <div className="col-span-1 lg:col-span-3 p-8 md:p-12">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">بيانات النشاط التجاري</h2>
                            
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">اسم النشاط أو صاحب الخدمة</label>
                                        <Input
                                            className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="مثال: مطعم البيتزا، أو محمد للسباكة"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">رقم الهاتف للتواصل</label>
                                        <Input
                                            className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="010xxxxxxxx"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">نوع الخدمة / التخصص</label>
                                    <select
                                        className="w-full h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner px-4 font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="">اختر التخصص...</option>
                                        <option value="مطاعم">مطاعم وكافيهات</option>
                                        <option value="صيانة">صيانة وخدمات منزلية (سباكة/كهرباء)</option>
                                        <option value="طبي">طبي وصيدليات</option>
                                        <option value="سيارات">خدمات سيارات</option>
                                        <option value="بقالة">سوبر ماركت</option>
                                        <option value="أخرى">أخرى</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">العنوان بالتفصيل</label>
                                    <Input
                                        className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="الحي، المجاورة، رقم المجاورة"
                                    />
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-6">إعدادات حساب الدخول (لوحة التحكم)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني</label>
                                            <Input
                                                type="email"
                                                className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">الرقم السري</label>
                                            <PasswordInput
                                                className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="******"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm rounded-xl font-bold mt-4">
                                        {error}
                                    </div>
                                )}

                                <div className="pt-4">
                                    <Button
                                        className="w-full h-16 rounded-[1.25rem] bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xl font-bold shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] font-cairo border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 btn-3d"
                                        onClick={handleSubmit}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "جاري تسجيل حسابك..." : "إنشاء حسابي مجاناً 🚀"}
                                    </Button>
                                    <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4">
                                        بتسجيلك، أنت توافق على شروط الاستخدام وسياسة الخصوصية.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
