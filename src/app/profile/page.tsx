"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Mail, Save, ArrowRight, Camera } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function ProfilePage() {
    const router = useRouter();
    const { currentUser, updateUser } = useAppStore();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            router.push("/login");
            return;
        }
        setName(currentUser.name);
        setEmail(currentUser.email);
    }, [currentUser, router]);

    const handleSave = () => {
        if (!currentUser) return;

        const success = updateUser(name, currentUser.email);

        if (success) {
            setIsEditing(false);
            // Optional: Show success feedback
        }
        // If fail, the store triggers an alert internally, so we just stay in edit mode
    };

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header with Back Button */}
                <div className="flex items-center gap-2 mb-6">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">الملف الشخصي</h1>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="overflow-hidden border-none shadow-lg">
                        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
                            <div className="absolute -bottom-12 right-8">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-white p-1 shadow-md">
                                        <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
                                            {name.charAt(0)}
                                        </div>
                                    </div>
                                    <button className="absolute bottom-0 left-0 bg-primary text-white p-1.5 rounded-full shadow-md hover:bg-primary/90 transition-colors">
                                        <Camera className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <CardHeader className="pt-16 pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl">{currentUser.name}</CardTitle>
                                    <CardDescription>{currentUser.type === 'user' ? 'عميل نشط' : 'مقدم خدمة'}</CardDescription>
                                </div>
                                {!isEditing && (
                                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                                        تعديل البيانات
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">الاسم بالكامل</Label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            readOnly={!isEditing}
                                            className={!isEditing ? "bg-slate-50" : ""}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">البريد الإلكتروني</Label>
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="email"
                                            value={email}
                                            readOnly
                                            className="bg-slate-50 text-slate-500"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">لا يمكن تغيير البريد الإلكتروني لأسباب أمنية</p>
                                </div>

                                {isEditing && (
                                    <div className="flex gap-3 pt-2">
                                        <Button onClick={handleSave} className="flex-1">
                                            <Save className="w-4 h-4 ml-2" />
                                            حفظ التغييرات
                                        </Button>
                                        <Button variant="ghost" onClick={() => {
                                            setName(currentUser.name);
                                            setIsEditing(false);
                                        }} className="flex-1">
                                            إلغاء
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Welcome Back Banner */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex items-center gap-4"
                >
                    <div className="bg-white p-2 rounded-full shadow-sm">
                        <span className="text-2xl">👋</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-indigo-900">مرحباً بعودتك يا {name.split(' ')[0]}!</h3>
                        <p className="text-indigo-700 text-sm">مبسوطين إنك معانا، تقدر تتابع طلباتك من هنا.</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
