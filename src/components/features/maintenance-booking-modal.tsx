"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MapPin, Wrench, Calendar, Clock, Phone, FileText } from "lucide-react";
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
        services?: any[];
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
            setAddress("");
            setPhone("");
            setAppointmentDate("");
            setAppointmentTime("");
            setNotes("");
            setCustomServiceType("");
        }, 300);
    };

    const handleSubmit = async () => {
        if (!address || !phone || !appointmentDate || !appointmentTime) {
            toast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        if (isCustom && !customServiceType) {
            toast("يرجى تحديد نوع الخدمة المطلوبة", "error");
            return;
        }

        setLoading(true);
        try {
            const finalServiceName = isCustom ? `طلب صيانة مخصص: ${customServiceType}` : serviceName;
            const fullDate = `${appointmentDate}T${appointmentTime}:00`;
            const detailsStr = `المنطقة: ${area} | العنوان: ${address} | الهاتف: ${phone} | الموعد: ${appointmentDate} ${appointmentTime}${notes ? ` | ملاحظات: ${notes}` : ''}`;

            const result = await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    serviceId: null,
                    userName: currentUser?.name || 'عميل',
                    serviceName: finalServiceName,
                    providerName: provider.name,
                    price: 0,
                    details: detailsStr,
                    items: [],
                    appointmentDate: fullDate,
                    appointmentType: 'maintenance'
                })
            });

            if (result.id) {
                // We rely on the provider dashboard to mark the slot as booked
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

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 dir-rtl">
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
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-blue-50/80 dark:bg-blue-950/40">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/60 rounded-xl">
                                <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                                {step === 2 ? "تم بنجاح ✓" : `حجز موعد - ${provider.name}`}
                            </h3>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors" title="إغلاق">
                            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    <div className="p-0 overflow-y-auto flex-1">
                        {step === 1 && (
                            <div className="p-5 sm:p-6 space-y-4">
                                {serviceName ? (
                                    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl p-3 text-center">
                                        <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">🔧 الخدمة المطلوبة: {serviceName}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            نوع الخدمة <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            placeholder="مثال: تصليح تكييف، صيانة غسالة..."
                                            value={customServiceType}
                                            onChange={(e) => setCustomServiceType(e.target.value)}
                                            className="h-11 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label htmlFor="maint-area" className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        المنطقة
                                    </label>
                                    <select
                                        id="maint-area"
                                        aria-label="اختر المنطقة"
                                        className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-colors"
                                        value={area}
                                        onChange={(e) => setArea(e.target.value)}
                                    >
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">الحي الأول</option>
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">الحي الثاني</option>
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">الحي الثالث</option>
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">ابني بيتك</option>
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">المنطقة الصناعية</option>
                                        <option className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">المنطقة الخامسة</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        العنوان بالتفصيل <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="اسم الشارع، رقم العمارة، الشقة..."
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="h-11 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-blue-500" />
                                        رقم الهاتف <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="01xxxxxxxxx"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-11 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl"
                                        dir="ltr"
                                    />
                                </div>

                                {availableDates.length > 0 ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                تاريخ الموعد (المتاح) <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-colors"
                                                value={appointmentDate}
                                                onChange={(e) => {
                                                    setAppointmentDate(e.target.value);
                                                    setAppointmentTime("");
                                                }}
                                            >
                                                <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">اختر اليوم</option>
                                                {availableDates.map(d => <option key={d} value={d} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{d}</option>)}
                                            </select>
                                        </div>

                                        {appointmentDate && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-blue-500" />
                                                    وقت الموعد <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-colors"
                                                    value={appointmentTime}
                                                    onChange={(e) => setAppointmentTime(e.target.value)}
                                                >
                                                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">اختر الوقت</option>
                                                    {timesForSelectedDate.map(t => <option key={t} value={t} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Fallback to simple inputs if no explicit availability */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-blue-500" />
                                                    التاريخ <span className="text-red-500">*</span>
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={appointmentDate}
                                                    onChange={(e) => setAppointmentDate(e.target.value)}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    className="h-11 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-blue-500" />
                                                    الوقت المفضل <span className="text-red-500">*</span>
                                                </label>
                                                <Input
                                                    type="time"
                                                    value={appointmentTime}
                                                    onChange={(e) => setAppointmentTime(e.target.value)}
                                                    className="h-11 bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        ملاحظات إضافية (اختياري)
                                    </label>
                                    <textarea
                                        placeholder="وصف المشكلة أو أي ملاحظات خاصة..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="flex min-h-20 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="p-6 text-center py-10 space-y-4">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">تم إرسال طلبك!</h2>
                                <p className="text-slate-600 dark:text-slate-300 text-base">
                                    سيقوم <span className="font-bold text-slate-900 dark:text-white">{provider.name}</span> بمراجعة طلبك وتأكيد أو تعديل الموعد خلال دقائق.
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl p-3.5 text-sm text-blue-700 dark:text-blue-300 mt-4">
                                    لا تنسَ متابعة الإشعارات في حسابك أو التحقق من قسم طلباتي لمعرفة حالة الحجز.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                        {step === 1 ? (
                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-md shadow-blue-600/20"
                            >
                                {loading ? "جاري التأكيد..." : "تأكيد الموعد"}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleClose}
                                className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                variant="outline"
                            >
                                إغلاق
                            </Button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

