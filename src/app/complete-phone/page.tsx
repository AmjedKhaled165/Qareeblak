"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PHONE_REGEX = /^\d{10,15}$/;

export default function CompletePhonePage() {
    const router = useRouter();
    const { currentUser, isInitialized, updateUser } = useAppStore();
    const { toast } = useToast();

    const [phone, setPhone] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isInitialized) return;

        const token = localStorage.getItem("qareeblak_token");
        if (!token || !currentUser) {
            router.replace("/login/user");
            return;
        }

        const userType = currentUser.user_type || currentUser.type;
        if (userType !== "customer") {
            router.replace("/");
            return;
        }

        const hasPhone = Boolean(String(currentUser.phone || "").trim());
        if (hasPhone) {
            const redirectTarget = localStorage.getItem("qareeblak_post_phone_redirect") || "/";
            localStorage.removeItem("qareeblak_phone_required");
            localStorage.removeItem("qareeblak_post_phone_redirect");
            router.replace(redirectTarget);
            return;
        }

        setPhone(currentUser.phone || "");
    }, [isInitialized, currentUser, router]);

    const handleSubmit = async () => {
        const normalizedPhone = phone.trim();

        if (!PHONE_REGEX.test(normalizedPhone)) {
            toast("رقم الهاتف يجب أن يكون من 10 إلى 15 رقم", "error");
            return;
        }

        setIsSaving(true);
        try {
            const ok = await updateUser({ phone: normalizedPhone });
            if (!ok) {
                toast("تعذر حفظ رقم الهاتف، حاول مرة أخرى", "error");
                return;
            }

            localStorage.removeItem("qareeblak_phone_required");
            const redirectTarget = localStorage.getItem("qareeblak_post_phone_redirect") || "/";
            localStorage.removeItem("qareeblak_post_phone_redirect");

            toast("تم حفظ رقم الهاتف بنجاح", "success");
            router.replace(redirectTarget);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "حدث خطأ أثناء حفظ رقم الهاتف";
            toast(message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-border/50 shadow-xl">
                <CardHeader className="text-right space-y-2">
                    <CardTitle className="text-2xl font-black">تأكيد رقم الهاتف</CardTitle>
                    <CardDescription>
                        لإكمال تسجيل الدخول باستخدام Google، لازم تسجل رقم التليفون أولاً.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 text-right">
                        <Label htmlFor="phone">رقم الهاتف</Label>
                        <div className="relative">
                            <Phone className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="phone"
                                dir="ltr"
                                className="pr-10"
                                placeholder="01012345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\s+/g, ""))}
                            />
                        </div>
                    </div>

                    <Button onClick={handleSubmit} className="w-full" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ والمتابعة"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
