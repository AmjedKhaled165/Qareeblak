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
        <div className="min-h-screen bg-background py-16 relative overflow-hidden">
            {/* Background logic matching landing page */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] z-0" />

            <div className="container mx-auto px-4 max-w-3xl relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground font-cairo">انضم لشركاء النجاح</h1>
                    <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                        هل تقدم خدمة مميزة؟ سجل معنا الآن واوصل لآلاف العملاء في أسيوط الجديدة مجاناً.
                    </p>
                </div>

                <Card className="border-border/50 bg-card shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-300">
                    <CardHeader className="p-8 border-b border-border/40 bg-muted/30">
                        <CardTitle className="text-2xl font-bold font-cairo text-foreground">بيانات مقدم الخدمة</CardTitle>
                        <CardDescription className="text-base">املأ البيانات بدقة لمراجعة طلبك</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-foreground/80 mr-1">الاسم بالكامل</label>
                                <Input
                                    className="h-12 rounded-xl bg-background border-border/50 focus:ring-2 focus:ring-primary/20"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="مثال: محمد أحمد"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-foreground/80 mr-1">رقم الهاتف</label>
                                <Input
                                    className="h-12 rounded-xl bg-background border-border/50 focus:ring-2 focus:ring-primary/20"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="01xxxxxxxxx"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 text-right">
                            <label className="text-sm font-bold text-foreground/80 mr-1">نوع الخدمة</label>
                            <select
                                title="نوع الخدمة"
                                className="flex h-12 w-full rounded-xl border border-border/50 bg-background px-4 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="">اختر التخصص...</option>
                                <option value="مطاعم">مطعم / كافيه</option>
                                <option value="صيانة">صيانة (سباكة/كهرباء)</option>
                                <option value="طبي">طبي / صيدلية</option>
                                <option value="سيارات">خدمات سيارات</option>
                                <option value="بقالة">سوبر ماركت</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                        </div>

                        <div className="space-y-3 text-right">
                            <label className="text-sm font-bold text-foreground/80 mr-1">العنوان بالتفصيل</label>
                            <Input
                                className="h-12 rounded-xl bg-background border-border/50 focus:ring-2 focus:ring-primary/20"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="الحي، المجاورة، رقم العمارة"
                            />
                        </div>

                        <div className="space-y-8 border-t border-border/40 pt-8">
                            <div className="text-right">
                                <h3 className="font-bold text-foreground mb-1 text-lg font-cairo">بيانات الدخول</h3>
                                <p className="text-xs text-muted-foreground">هذه البيانات ستستخدم لدخول لوحة التحكم لاحقاً</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-foreground/80 mr-1">البريد الإلكتروني</label>
                                    <Input
                                        className="h-12 rounded-xl bg-background border-border/50 focus:ring-2 focus:ring-primary/20"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="baraka@example.com"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-foreground/80 mr-1">كلمة المرور</label>
                                    <PasswordInput
                                        className="h-12 rounded-xl bg-background border-border/50 focus:ring-2 focus:ring-primary/20"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="******"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 text-right">
                            <label className="text-sm font-bold text-foreground/80 mr-1">نبذة عن خدماتك (اختياري)</label>
                            <textarea
                                className="flex min-h-[120px] w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="اوصف خدماتك للعملاء..."
                            />
                        </div>

                        <div className="bg-primary/5 p-5 rounded-2xl flex items-start gap-4 border border-primary/10">
                            <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                            <div className="text-sm text-foreground/80 font-medium leading-relaxed">
                                بمجرد إرسال الطلب، سيتم إنشاء حسابك وتفعيله تلقائياً بعد مراجعة الفريق المختص.
                            </div>
                        </div>

                        <div className="pt-4">
                            {error && (
                                <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20 mb-6 text-center font-bold font-cairo">
                                    {error}
                                </div>
                            )}

                            <Button
                                className="w-full h-16 rounded-[1.25rem] bg-primary hover:bg-primary/90 text-white text-xl font-bold shadow-xl shadow-primary/20 transition-all active:scale-[0.98] font-cairo"
                                onClick={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? "جاري تسجيل الطلب..." : "إرسال الطلب للانضمام 🚀"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
