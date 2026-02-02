"use client";

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Clock className="h-10 w-10 text-orange-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-orange-700 mb-2">تم استلام طلبك!</h2>
                    <p className="text-muted-foreground mb-4">
                        شكراً لانضمامك إلينا يا <strong>{formData.name}</strong>.
                    </p>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800 mb-6">
                        سيقوم فريقنا بمراجعة طلبك والتواصل معك قريباً.
                        <br />
                        بعد الموافقة، يمكنك تسجيل الدخول باستخدام بريدك الإلكتروني.
                    </div>
                    <Button onClick={() => router.push("/")} className="w-full">
                        العودة للرئيسية
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold mb-4">انضم لشركاء النجاح</h1>
                    <p className="text-muted-foreground text-lg">
                        هل تقدم خدمة مميزة؟ سجل معنا الآن واوصل لآلاف العملاء في أسيوط الجديدة مجاناً.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>بيانات مقدم الخدمة</CardTitle>
                        <CardDescription>املأ البيانات بدقة لمراجعة طلبك</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">الاسم بالكامل</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="مثال: محمد أحمد"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">رقم الهاتف</label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="01xxxxxxxxx"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">نوع الخدمة</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

                        <div className="space-y-2">
                            <label className="text-sm font-medium">العنوان بالتفصيل</label>
                            <Input
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="الحي، المجاورة، رقم العمارة"
                            />
                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                            <div className="md:col-span-2">
                                <h3 className="font-semibold text-slate-800 mb-2 text-sm">بيانات الدخول (لوحة التحكم)</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">البريد الإلكتروني</label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="اسمك@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">كلمة المرور</label>
                                <Input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="******"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">نبذة عن خدماتك (اختياري)</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="اوصف خدماتك للعملاء..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            ></textarea>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                بمجرد إرسال الطلب، سيتم إنشاء حسابك وتفعيله تلقائياً.
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                                {error}
                            </div>
                        )}

                        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? "جاري التسجيل..." : "إرسال الطلب"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div >
    )
}
