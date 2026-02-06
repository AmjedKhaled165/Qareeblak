"use client";

import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/components/providers/AppProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Mail, Save, ArrowRight, Camera, Phone, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

export default function ProfilePage() {
    const router = useRouter();
    const { currentUser, updateUser } = useAppStore();
    const { toast } = useToast();

    // Form States
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [avatar, setAvatar] = useState("");

    // Password States
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!currentUser) {
            router.push("/login");
            return;
        }
        setName(currentUser.name || "");
        setEmail(currentUser.email || "");
        setPhone(currentUser.phone || "");
        setAvatar(currentUser.avatar || "");
    }, [currentUser, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
                setIsEditing(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;

        // Validation
        if (newPassword && !oldPassword) {
            toast("يرجى إدخال كلمة المرور الحالية لتغيير كلمة المرور", "error");
            return;
        }

        setIsLoading(true);
        try {
            await updateUser({
                name,
                email,
                phone,
                avatar,
                oldPassword: oldPassword || undefined,
                newPassword: newPassword || undefined
            });

            toast("تم حفظ التغييرات بنجاح ✅", "success");
            setIsEditing(false);
            setOldPassword("");
            setNewPassword("");
        } catch (error: any) {
            toast(error.message || "حدث خطأ أثناء التحديث", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentUser) return null;

    const isProvider = currentUser.type === 'provider';

    return (
        <div className={`min-h-screen transition-all duration-500 p-4 md:p-8 bg-background`}>
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header with Back Button */}
                <div className="flex items-center gap-2 mb-6">
                    <Link href={isProvider ? "/provider-dashboard" : "/"} title="العودة">
                        <Button variant="ghost" size="icon" className="hover:bg-accent transition-colors" title="العودة">
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="overflow-hidden border-border bg-card shadow-2xl transition-colors duration-500">
                        <div className="h-40 bg-gradient-to-r from-indigo-600 to-purple-700 relative">
                            <div className="absolute -bottom-12 right-8">
                                <div className="relative group/avatar">
                                    <div className="w-28 h-28 rounded-full p-1 shadow-2xl overflow-hidden bg-card border-4 border-background">
                                        {avatar ? (
                                            <img src={avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full rounded-full flex items-center justify-center text-4xl font-bold bg-muted text-muted-foreground">
                                                {name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        hidden
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        onClick={() => isEditing && fileInputRef.current?.click()}
                                        title="تغيير الصورة"
                                        aria-label="تغيير الصورة"
                                        className={`absolute bottom-2 left-2 bg-primary text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-110 ${isEditing ? 'cursor-pointer' : 'opacity-0 pointer-events-none'}`}
                                    >
                                        <Camera className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <CardHeader className="pt-16 pb-2 px-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-3xl font-black font-cairo text-foreground">{currentUser.name}</CardTitle>
                                    <CardDescription className="font-bold text-muted-foreground">
                                        {currentUser.type === 'customer' ? 'عميل نشط' : 'مقدم خدمة'}
                                    </CardDescription>
                                </div>
                                {!isEditing && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEditing(true)}
                                        className="rounded-xl font-bold bg-background hover:bg-accent border-border"
                                    >
                                        تعديل البيانات
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-8 p-8 border-t border-border/50">
                            <div className="space-y-5">
                                {/* Name */}
                                <div className="grid gap-2 text-right">
                                    <Label htmlFor="name" className="text-sm font-bold text-muted-foreground mr-1">الاسم بالكامل</Label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            readOnly={!isEditing}
                                            className={`h-12 px-10 rounded-xl transition-all border-border bg-background text-foreground focus:ring-primary/20 ${!isEditing ? "opacity-70 bg-muted/30" : ""}`}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="grid gap-2 text-right">
                                    <Label htmlFor="email" className="text-sm font-bold text-muted-foreground mr-1">البريد الإلكتروني</Label>
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            readOnly={!isEditing}
                                            className={`h-12 px-10 rounded-xl transition-all border-border bg-background text-foreground text-right focus:ring-primary/20 ${!isEditing ? "opacity-70 bg-muted/30" : ""}`}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="grid gap-2 text-right">
                                    <Label htmlFor="phone" className="text-sm font-bold text-muted-foreground mr-1">رقم الهاتف</Label>
                                    <div className="relative">
                                        <Phone className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            readOnly={!isEditing}
                                            className={`h-12 px-10 rounded-xl transition-all border-border bg-background text-foreground focus:ring-primary/20 ${!isEditing ? "opacity-70 bg-muted/30" : ""}`}
                                            dir="ltr"
                                            placeholder="01xxxxxxxxx"
                                        />
                                    </div>
                                </div>

                                {/* Password Section */}
                                {isEditing && (
                                    <div className="pt-6 border-t border-border/50 space-y-5">
                                        <h3 className="font-black text-lg font-cairo text-foreground">تغيير كلمة المرور</h3>

                                        <div className="grid gap-2 text-right">
                                            <Label htmlFor="oldPassword" className="text-sm font-bold text-muted-foreground mr-1">كلمة المرور الحالية (مطلوب للتغيير)</Label>
                                            <div className="relative">
                                                <Lock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="oldPassword"
                                                    type={showPassword ? "text" : "password"}
                                                    value={oldPassword}
                                                    onChange={(e) => setOldPassword(e.target.value)}
                                                    className="h-12 px-10 rounded-xl transition-all border-border bg-background text-foreground text-right focus:ring-primary/20"
                                                    placeholder="أدخل كلمة المرور الحالية"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2 text-right">
                                            <Label htmlFor="newPassword" className="text-sm font-bold text-muted-foreground mr-1">كلمة المرور الجديدة</Label>
                                            <div className="relative">
                                                <Lock className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="newPassword"
                                                    type={showPassword ? "text" : "password"}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="h-12 px-10 rounded-xl transition-all border-border bg-background text-foreground text-right focus:ring-primary/20"
                                                    placeholder="أدخل كلمة المرور الجديدة"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute left-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isEditing && (
                                    <div className="flex gap-4 pt-6">
                                        <Button
                                            onClick={handleSave}
                                            className="flex-1 h-14 rounded-xl font-black text-lg transition-all active:scale-95 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
                                            disabled={isLoading}
                                        >
                                            <Save className="w-5 h-5 ml-3" />
                                            {isLoading ? "جاري الحفظ..." : "حفظ التغييرات"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-14 px-8 rounded-xl font-bold flex-1 bg-muted hover:bg-muted/80 text-foreground"
                                            onClick={() => {
                                                setName(currentUser.name || "");
                                                setEmail(currentUser.email || "");
                                                setPhone(currentUser.phone || "");
                                                setAvatar(currentUser.avatar || "");
                                                setOldPassword("");
                                                setNewPassword("");
                                                setIsEditing(false);
                                            }}
                                            disabled={isLoading}
                                        >
                                            إلغاء
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
