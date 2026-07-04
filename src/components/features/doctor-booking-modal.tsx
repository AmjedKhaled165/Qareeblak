"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MapPin, Stethoscope, Calendar, Clock, Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface DoctorBookingModalProps {
    provider: {
        id: string;
        name: string;
        category: string;
        services?: any[];
    };
    serviceName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DoctorBookingModal({ provider, serviceName, open, onOpenChange }: DoctorBookingModalProps) {
    const { toast } = useToast();
    const { currentUser } = useAppStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [patientName, setPatientName] = useState(currentUser?.name || "");
    const [phone, setPhone] = useState("");
    const [appointmentDate, setAppointmentDate] = useState("");
    const [appointmentTime, setAppointmentTime] = useState("");
    const [notes, setNotes] = useState("");
    
    // Custom booking
    const isCustom = !serviceName;
    const [customServiceType, setCustomServiceType] = useState("");

    // Extract availability
    const availabilityService = provider.services?.find(s => s.name === '__AVAILABILITY__');
    const availableSlots = useMemo(() => {
        if (!availabilityService?.description) return [];
        try {
            const parsed = JSON.parse(availabilityService.description);
            // Filter out booked slots
            return Array.isArray(parsed) ? parsed.filter(slot => slot.status !== 'booked') : [];
        } catch (e) {
            return [];
        }
    }, [availabilityService]);

    const availableDates = useMemo(() => {
        const dates = new Set(availableSlots.map((s: any) => s.date));
        return Array.from(dates) as string[];
    }, [availableSlots]);

    const timesForSelectedDate = useMemo(() => {
        if (!appointmentDate) return [];
        return availableSlots.filter((s: any) => s.date === appointmentDate).map((s: any) => s.time);
    }, [appointmentDate, availableSlots]);

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep(1);
            setPatientName(currentUser?.name || "");
            setPhone("");
            setAppointmentDate("");
            setAppointmentTime("");
            setNotes("");
            setCustomServiceType("");
        }, 300);
    };

    const handleSubmit = async () => {
        if (!patientName || !phone || !appointmentDate || !appointmentTime) {
            toast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        if (isCustom && !customServiceType) {
            toast("يرجى تحديد نوع الخدمة المطلوبة", "error");
            return;
        }

        setLoading(true);
        try {
            const finalServiceName = isCustom ? `حجز مخصص: ${customServiceType}` : serviceName;
            const fullDate = `${appointmentDate}T${appointmentTime}:00`;
            const detailsStr = `المريض: ${patientName} | الهاتف: ${phone} | الموعد: ${appointmentDate} ${appointmentTime}${notes ? ` | تفاصيل: ${notes}` : ''}`;

            const result = await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    serviceId: null,
                    userName: patientName,
                    serviceName: finalServiceName,
                    providerName: provider.name,
                    price: 0,
                    details: detailsStr,
                    items: [],
                    appointmentDate: fullDate,
                    appointmentType: 'medical'
                })
            });

            if (result.id) {
                // Here we ideally want to mark the slot as booked, but since we are a customer, we can't edit the provider's service directly.
                // We rely on the provider dashboard to mark it as booked.
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
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-950/30">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/50 rounded-full">
                                <Stethoscope className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <h3 className="font-bold text-lg">
                                {step === 2 ? "تم بنجاح ✓" : `حجز موعد - ${provider.name}`}
                            </h3>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" title="إغلاق">
                            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    <div className="p-0 overflow-y-auto flex-1">
                        {step === 1 && (
                            <div className="p-6 space-y-5">
                                {serviceName ? (
                                    <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 text-center">
                                        <span className="text-sm text-cyan-700 dark:text-cyan-300 font-semibold">👨‍⚕️ الخدمة المطلوبة: {serviceName}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-cyan-500" />
                                            الخدمة المطلوبة <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            placeholder="مثال: كشف، تنظيف أسنان، إبرة..."
                                            value={customServiceType}
                                            onChange={(e) => setCustomServiceType(e.target.value)}
                                            className="h-11"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Stethoscope className="h-4 w-4 text-cyan-500" />
                                        اسم المريض <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        placeholder="الاسم الثلاثي"
                                        value={patientName}
                                        onChange={(e) => setPatientName(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-cyan-500" />
                                        رقم الهاتف <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        placeholder="01xxxxxxxxx"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-11"
                                        dir="ltr"
                                    />
                                </div>

                                {availableDates.length > 0 ? (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-cyan-500" />
                                                تاريخ الموعد (المتاح) <span className="text-destructive">*</span>
                                            </label>
                                            <select
                                                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                                value={appointmentDate}
                                                onChange={(e) => {
                                                    setAppointmentDate(e.target.value);
                                                    setAppointmentTime(""); // Reset time when date changes
                                                }}
                                            >
                                                <option value="">اختر اليوم</option>
                                                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>

                                        {appointmentDate && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-cyan-500" />
                                                    وقت الموعد <span className="text-destructive">*</span>
                                                </label>
                                                <select
                                                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                                    value={appointmentTime}
                                                    onChange={(e) => setAppointmentTime(e.target.value)}
                                                >
                                                    <option value="">اختر الوقت</option>
                                                    {timesForSelectedDate.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-cyan-500" />
                                                تاريخ الموعد <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="date"
                                                value={appointmentDate}
                                                onChange={(e) => setAppointmentDate(e.target.value)}
                                                min={today}
                                                className="h-11"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">الدكتور لم يحدد مواعيد مسبقة، سيتم تأكيد الموعد معه.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-cyan-500" />
                                                الوقت المقترح <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                type="time"
                                                value={appointmentTime}
                                                onChange={(e) => setAppointmentTime(e.target.value)}
                                                className="h-11"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">
                                        ملاحظات للطبيب (اختياري)
                                    </label>
                                    <textarea
                                        placeholder="وصف الحالة، أدوية يتم تناولها..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="p-6 text-center py-10 space-y-4">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">تم إرسال طلب الحجز!</h2>
                                <p className="text-muted-foreground text-base">
                                    سيقوم <span className="font-bold text-foreground">{provider.name}</span> بمراجعة الطلب وسيصلك إشعار بالقبول.
                                </p>
                                <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 text-sm text-cyan-700 dark:text-cyan-300 mt-4">
                                    📅 الموعد المطلوب: {appointmentDate} — {appointmentTime}
                                </div>
                            </div>
                        )}
                    </div>

                    {step === 1 && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <Button
                                className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-base rounded-xl shadow-lg shadow-cyan-500/20"
                                onClick={handleSubmit}
                                disabled={loading || !patientName || !phone || !appointmentDate || !appointmentTime || (isCustom && !customServiceType)}
                            >
                                {loading ? "جاري الإرسال..." : "تأكيد الحجز 📅"}
                            </Button>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <Button className="w-full h-12 font-bold rounded-xl" variant="outline" onClick={handleClose}>
                                العودة
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
