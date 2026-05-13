import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <Card className="border-border/50 bg-card rounded-[2rem] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold font-cairo text-foreground">سياسة الخصوصية</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            نلتزم بحماية خصوصيتك. توضح هذه الصفحة كيف نجمع بياناتك ونستخدمها ونحميها عند استخدامك لمنصة قريبلك.
                        </p>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">البيانات التي نجمعها</p>
                            <p>
                                قد نجمع معلومات مثل الاسم والبريد الإلكتروني ورقم الهاتف وبيانات الطلبات ومعلومات الموقع (عند الحاجة) لتحسين الخدمة.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">استخدام البيانات</p>
                            <p>
                                نستخدم البيانات لتقديم الخدمة، ودعم العملاء، وتحسين تجربة المستخدم، وإرسال إشعارات مرتبطة بالطلبات فقط.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">حماية البيانات</p>
                            <p>
                                نطبق إجراءات أمنية مناسبة لحماية بياناتك. ومع ذلك، لا يمكن ضمان الأمان بنسبة 100% على الإنترنت.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">التواصل</p>
                            <p>
                                للاستفسارات المتعلقة بالخصوصية، تواصل معنا عبر البريد الظاهر في صفحة تواصل معنا.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
