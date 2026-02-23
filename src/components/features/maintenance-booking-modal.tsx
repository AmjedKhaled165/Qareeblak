"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MapPin, Wrench, Calendar, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface MaintenanceBookingModalProps {
    provider: {
        id: string;
        name: string;
        category: string;
    };
    serviceName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MaintenanceBookingModal({ provider, serviceName, open, onOpenChange }: MaintenanceBookingModalProps) {
    const { toast } = useToast();
    const { currentUser } = useAppStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [area, setArea] = useState("الحي الأول");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [appointmentDate, setAppointmentDate] = useState("");
    const [appointmentTime, setAppointmentTime] = useState("");
    const [notes, setNotes] = useState("");

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep(1);
            setAddress("");
            setPhone("");
            setAppointmentDate("");
            setAppointmentTime("");
            setNotes("");
        }, 300);
    };

    const handleSubmit = async () => {
        if (!address || !phone || !appointmentDate || !appointmentTime) {
            toast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        setLoading(true);
        try {
            const fullDate = `${appointmentDate}T${appointmentTime}:00`;
            const detailsStr = `المنطقة: ${area} | العنوان: ${address} | الهاتف: ${phone} | الموعد: ${appointmentDate} ${appointmentTime}${notes ? ` | ملاحظات: ${notes}` : ''}`;

            const result = await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    serviceId: null,
                    userName: currentUser?.name || 'عميل',
                    serviceName: serviceName || 'حجز صيانة',
                    providerName: provider.name,
                    price: 0,
                    details: detailsStr,
                    items: [],
                    appointmentDate: fullDate,
                    appointmentType: 'maintenance'
                })
            });

            if (result.id) {
                setStep(2); // success step
            } else {
                toast("حدث خطأ في إنشاء الحجز", "error");
            }
        } catch (error) {
            console.error('Booking error:', error);
            toast("حدث خطأ في إنشاء الحجز", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    // Get minimum date (today)
    const today = new Date().toISOString().split('T')[0];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/30">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                                <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-bold text-lg">
                                {step === 2 ? "تم بنجاح ✓" : `حجز موعد - ${provider.name}`}
                            </h3>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" title="إغلاق" aria-label="إغلاق">
                            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-0 overflow-y-auto flex-1">
                        {step === 1 && (
                            <div className="p-6 space-y-5">
                                {/* Service name banner */}
                                {serviceName && (
                                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
                                        <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">🔧 {serviceName}</span>
                                    </div>
                                )}

                                {/* Region */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-area" className="text-sm font-bold flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        المنطقة
                                    </label>
                                    <select
                                        id="maint-area"
                                        aria-label="اختر المنطقة"
                                        className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        value={area}
                                        onChange={(e) => setArea(e.target.value)}
                                    >
                                        <option>الحي الأول</option>
                                        <option>الحي الثاني</option>
                                        <option>الحي الثالث</option>
                                        <option>ابني بيتك</option>
                                        <option>المنطقة الصناعية</option>
                                        <option>المنطقة الخامسة</option>
                                    </select>
                                </div>

                                {/* Detailed Address */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-address" className="text-sm font-bold flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        العنوان بالتفصيل <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="maint-address"
                                        placeholder="اسم الشارع، رقم العمارة، الشقة..."
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                {/* Phone */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-phone" className="text-sm font-bold flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-blue-500" />
                                        رقم الهاتف <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="maint-phone"
                                        placeholder="01xxxxxxxxx"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-11"
                                        dir="ltr"
                                    />
                                </div>

                                {/* Date */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-date" className="text-sm font-bold flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        تاريخ الموعد <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="maint-date"
                                        type="date"
                                        value={appointmentDate}
                                        onChange={(e) => setAppointmentDate(e.target.value)}
                                        min={today}
                                        className="h-11"
                                    />
                                </div>

                                {/* Time */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-time" className="text-sm font-bold flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        وقت الموعد <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="maint-time"
                                        type="time"
                                        value={appointmentTime}
                                        onChange={(e) => setAppointmentTime(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <label htmlFor="maint-notes" className="text-sm font-bold">
                                        ملاحظات إضافية (اختياري)
                                    </label>
                                    <textarea
                                        id="maint-notes"
                                        placeholder="وصف المشكلة أو أي ملاحظات خاصة..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="p-6 text-center py-10 space-y-4">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">تم إرسال طلبك!</h2>
                                <p className="text-muted-foreground text-base">
                                    سيقوم <span className="font-bold text-foreground">{provider.name}</span> بمراجعة طلبك وتأكيد أو تعديل الموعد خلال دقائق.
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300 mt-4">
                                    📅 الموعد المطلوب: {appointmentDate} — {appointmentTime}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    ستتلقى إشعاراً فور تأكيد أو تغيير الموعد من مقدم الخدمة.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {step === 1 && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <Button
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/20"
                                onClick={handleSubmit}
                                disabled={loading || !address || !phone || !appointmentDate || !appointmentTime}
                            >
                                {loading ? "جاري الإرسال..." : "تأكيد الحجز 📅"}
                            </Button>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <Button className="w-full h-12 font-bold rounded-xl" variant="outline" onClick={handleClose}>
                                العودة للرئيسية
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
