"use client";

import { useState } from "react";
import {
    Settings, Save, Bell, Shield, Phone, Globe,
    Database, RefreshCw, AlertTriangle, CheckCircle2, Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/ToastProvider";

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        platformName: "قريبلك | Qareeblak",
        supportPhone: "01088774433",
        supportWhatsApp: "01088774433",
        supportEmail: "support@qareeblak.com",
        maintenanceMode: false,
        enableAutoAssignCourier: true,
        enableWhatsAppNotifications: true,
        enableWheelOfFortune: true,
    });

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            toast("تم حفظ إعدادات النظام بنجاح ✅", "success");
        }, 500);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Settings className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        إعدادات المنصة والنظام
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        التحكم في بيانات التواصل والدعم الفني وخصائص المنصة الأساسية
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
            </div>

            <div className="space-y-6">
                {/* General Settings */}
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-600" />
                            بيانات المنصة والدعم الفني
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                اسم المنصة الرسمي
                            </label>
                            <Input
                                value={settings.platformName}
                                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                    رقم هاتف الدعم الفني / الطوارئ
                                </label>
                                <Input
                                    value={settings.supportPhone}
                                    onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                                    className="h-9 text-sm"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                    رقم واتساب خدمة العملاء
                                </label>
                                <Input
                                    value={settings.supportWhatsApp}
                                    onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })}
                                    className="h-9 text-sm"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Operations & Automation Settings */}
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-600" />
                            التحكم في الميزات والتشغيل الآلي
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">إسناد المناديب التلقائي (Auto-Dispatch)</h4>
                                <p className="text-xs text-slate-400">إرسال إشعار التوصيل لأقرب كابتن متاح تلقائياً عند قبول الطلب</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enableAutoAssignCourier}
                                onChange={(e) => setSettings({ ...settings, enableAutoAssignCourier: e.target.checked })}
                                className="w-5 h-5 rounded text-indigo-600"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">إشعارات الواتساب (WhatsApp Bot)</h4>
                                <p className="text-xs text-slate-400">إرسال رسائل التحديثات والفواتير للعملاء والمقدمين عبر واتساب</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enableWhatsAppNotifications}
                                onChange={(e) => setSettings({ ...settings, enableWhatsAppNotifications: e.target.checked })}
                                className="w-5 h-5 rounded text-indigo-600"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">عجلة الحظ الترويجية (Wheel of Fortune)</h4>
                                <p className="text-xs text-slate-400">تفعيل سحب الجوائز والكوبونات اليومية للمستخدمين</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enableWheelOfFortune}
                                onChange={(e) => setSettings({ ...settings, enableWheelOfFortune: e.target.checked })}
                                className="w-5 h-5 rounded text-indigo-600"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
