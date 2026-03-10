import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <Card className="border-border/50 bg-card rounded-[2rem] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold font-cairo text-foreground">شروط الاستخدام</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            باستخدامك لمنصة قريبلك، فإنك توافق على الالتزام بهذه الشروط. نهدف لتوفير تجربة آمنة وعادلة لجميع المستخدمين.
                        </p>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">دور المنصة</p>
                            <p>
                                قريبلك منصة وسيطة تربط العملاء بمقدمي الخدمات. جودة تنفيذ الخدمة ومسؤولياتها تقع على مقدم الخدمة.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">الحساب والمسؤولية</p>
                            <p>
                                أنت مسؤول عن صحة البيانات في حسابك والحفاظ على سرية بيانات الدخول. يمنع إساءة استخدام المنصة أو محاولة اختراقها.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">الإلغاء والنزاعات</p>
                            <p>
                                قد تطبق رسوم إلغاء في حالات معينة حسب نوع الخدمة والوقت. في حال النزاعات سنحاول المساعدة قدر الإمكان دون تحمل مسؤولية مباشرة عن التنفيذ.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-foreground">التعديلات</p>
                            <p>
                                قد نقوم بتحديث هذه الشروط من وقت لآخر. استمرار استخدامك للمنصة يعني قبولك للتحديثات.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
