"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Shield, Globe, Lock, Ban, Plus, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState({
        appName: "قريب لك - Qareeblak",
        supportEmail: "support@qareeblak.com",
        supportPhone: "+201000000000",
        autoAcceptOrders: false,
        enablePushNotifications: true,
        maintenanceMode: false,
    });

    const [bannedIPs, setBannedIPs] = useState<string[]>([
        "197.45.12.90",
        "156.204.88.11",
        "41.238.102.4"
    ]);
    const [newIP, setNewIP] = useState("");

    const handleSave = () => {
        toast("تم حفظ إعدادات النظام وجدار الحماية بنجاح ⚙️", "success");
    };

    const handleAddIPBan = () => {
        if (!newIP.trim()) return;
        if (bannedIPs.includes(newIP.trim())) {
            toast("عنوان الـ IP محظور بالفعل", "error");
            return;
        }
        setBannedIPs([...bannedIPs, newIP.trim()]);
        toast(`تم إضافة IP (${newIP.trim()}) إلى جدار الحماية وقائمة الحظر 🚫`, "success");
        setNewIP("");
    };

    const handleRemoveIPBan = (ip: string) => {
        setBannedIPs(bannedIPs.filter(item => item !== ip));
        toast(`تم إزالة IP (${ip}) من قائمة الحظر ✅`, "info");
    };

    return (
        <div className="space-y-6" dir="rtl">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">⚙️ إعدادات النظام وجدار الحماية</h1>
                <p className="text-slate-500 text-sm font-cairo mt-1">تكوين إعدادات المنصة، تتبع عناوين الـ IP، وإدارة جدار الحماية للحظر الفوري</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Platform Settings */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-cairo flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-500" />
                            الإعدادات العامة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 font-cairo">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">اسم المنصة</label>
                            <Input
                                value={settings.appName}
                                onChange={e => setSettings({ ...settings, appName: e.target.value })}
                                className="rounded-xl"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">بريد الدعم الفني</label>
                            <Input
                                value={settings.supportEmail}
                                onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                                className="rounded-xl font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">رقم الدعم الفني والواتساب</label>
                            <Input
                                value={settings.supportPhone}
                                onChange={e => setSettings({ ...settings, supportPhone: e.target.value })}
                                className="rounded-xl font-mono"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Operations & System Controls */}
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-cairo flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-500" />
                            تحكم التشغيل والأمان
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 font-cairo">
                        <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">القبول التلقائي للطلبات</p>
                                <p className="text-xs text-slate-400">توجيه الطلبات تلقائياً للمناديب والمتاجر</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.autoAcceptOrders}
                                onChange={e => setSettings({ ...settings, autoAcceptOrders: e.target.checked })}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">تفعيل الإشعارات الفورية (Push Notifications)</p>
                                <p className="text-xs text-slate-400">إرسال تنبيهات لحظية للعملاء والمناديب</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enablePushNotifications}
                                onChange={e => setSettings({ ...settings, enablePushNotifications: e.target.checked })}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/20 cursor-pointer">
                            <div>
                                <p className="font-bold text-red-600 dark:text-red-400 text-sm">وضع الصيانة (Maintenance Mode)</p>
                                <p className="text-xs text-red-400">إيقاف استقبال طلبات جديدة مؤقتاً</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.maintenanceMode}
                                onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                            />
                        </label>
                    </CardContent>
                </Card>

                {/* IP Firewall & Hardware Device Protection */}
                <Card className="md:col-span-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-cairo flex items-center gap-2 text-red-600 dark:text-red-400">
                            <ShieldAlert className="w-5 h-5" />
                            جدار حماية الـ IP وعناوين الأجهزة (IP Firewall Blacklist)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 font-cairo">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            يتم التقاط وتسجيل عنوان الـ IP الفعلي وبصمة الجهاز تلقائياً لكل جهاز يدخل النظام. يمكنك إضافة عناوين IP للقائمة السوداء لحظرها فوراً ومنع أي جهاز متصل من هذه الشبكة من الوصول.
                        </p>

                        <div className="flex gap-2">
                            <Input
                                placeholder="أدخل عنوان الـ IP لحظره (مثال: 197.45.12.90)..."
                                value={newIP}
                                onChange={e => setNewIP(e.target.value)}
                                className="rounded-xl font-mono text-sm flex-1 dir-ltr text-right"
                            />
                            <Button onClick={handleAddIPBan} className="gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">
                                <Plus className="w-4 h-4" />
                                إضافة حظر الـ IP
                            </Button>
                        </div>

                        <div className="space-y-2 pt-2">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">عناوين الـ IP المحظورة حالياً ({bannedIPs.length}):</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {bannedIPs.map(ip => (
                                    <div key={ip} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                                        <span className="font-mono text-sm font-bold text-red-600 dark:text-red-400">{ip}</span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRemoveIPBan(ip)}
                                            className="h-7 text-xs text-slate-500 hover:text-red-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            فك الحظر
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button onClick={handleSave} className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                <Save className="w-4 h-4" />
                                حفظ إعدادات النظام وجدار الحماية
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
