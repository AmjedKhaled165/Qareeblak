"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Calendar, Clock, Trophy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface PlaygroundsBookingModalProps {
    provider: {
        id: string;
        name: string;
        category: string;
        services?: any[];
        location?: string;
    };
    serviceName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PlaygroundsBookingModal({ provider, serviceName, open, onOpenChange }: PlaygroundsBookingModalProps) {
    const { toast } = useToast();
    const { currentUser } = useAppStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [customerName, setCustomerName] = useState(currentUser?.name || "");
    const [phone, setPhone] = useState("");
    const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [appointmentTimes, setAppointmentTimes] = useState<string[]>([]);
    
    // Extract availability
    const availabilityService = provider.services?.find(s => s.name === '__AVAILABILITY__');
    const allSlots = useMemo(() => {
        if (!availabilityService?.description) return [];
        try {
            const parsed = JSON.parse(availabilityService.description);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.slots)) return parsed.slots;
            return [];
        } catch (e) {
            return [];
        }
    }, [availabilityService]);

    const timesForSelectedDate = useMemo(() => {
        if (!appointmentDate) return [];
        const savedSlots = allSlots.filter((s: any) => s.date === appointmentDate);
        
        // Generate all 24 hours slots
        const slots = [];
        for (let i = 0; i < 24; i++) {
            const start = i;
            const end = (i + 1) % 24;
            const formatHour = (h: number) => {
                const ampm = h >= 12 ? 'م' : 'ص';
                const hour12 = h % 12 || 12;
                return `${hour12.toString().padStart(2, '0')}:00 ${ampm}`;
            };
            const timeStr = `${formatHour(start)} - ${formatHour(end)}`;
            
            // Check if this slot was modified (booked/unavailable)
            const savedSlot = savedSlots.find((s: any) => s.time === timeStr);
            slots.push({
                time: timeStr,
                status: savedSlot ? savedSlot.status : 'available',
                bookedBy: savedSlot ? savedSlot.bookedBy : null
            });
        }
        return slots;
    }, [appointmentDate, allSlots]);

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep(1);
            setCustomerName(currentUser?.name || "");
            setPhone("");
            setAppointmentDate(new Date().toISOString().split('T')[0]);
            setAppointmentTimes([]);
        }, 300);
    };

    const toggleTime = (time: string) => {
        setAppointmentTimes(prev => 
            prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
        );
    };

    const handleSubmit = async () => {
        if (!customerName || !appointmentDate || appointmentTimes.length === 0) {
            toast("يرجى ملء جميع الحقول المطلوبة واختيار وقت على الأقل", "error");
            return;
        }

        setLoading(true);
        try {
            const finalServiceName = serviceName || `حجز ملعب`;
            const detailsStr = `الاسم: ${customerName} | الموعد: ${appointmentDate} (${appointmentTimes.join(' - ')})`;

            const result = await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    serviceId: null,
                    userName: customerName,
                    phone: phone || "0000000000", // Phone might be optional for playgrounds if hidden
                    address: "حجز ملعب",
                    location: "ملاعب",
                    serviceName: finalServiceName,
                    details: detailsStr,
                    price: 0,
                    appointmentDate: `${appointmentDate}T00:00:00`,
                    appointmentType: 'playground'
                })
            });


            setStep(2); // Success step
        } catch (error) {
            console.error('Booking failed:', error);
            toast("حدث خطأ أثناء الحجز، يرجى المحاولة مرة أخرى", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm dir-rtl">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="bg-green-600 p-6 text-white relative shrink-0">
                        <button
                            onClick={handleClose}
                            className="absolute top-4 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Trophy className="w-8 h-8 text-green-100" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black font-cairo">حجز موعد بملعب</h2>
                                <p className="text-green-100 mt-1 font-medium text-sm flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" />
                                    {provider.name} {provider.location && `- ${provider.location}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
                        {step === 1 ? (
                            <div className="space-y-6">
                                {/* Date Selection */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <Calendar className="w-4 h-4 text-green-600" />
                                        حدد اليوم والشهر والسنة
                                    </label>
                                    <Input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={appointmentDate}
                                        onChange={(e) => setAppointmentDate(e.target.value)}
                                        className="h-14 rounded-2xl bg-muted/50 border-transparent focus:border-green-500 focus:bg-background text-lg font-bold"
                                    />
                                </div>

                                {/* Time Grid */}
                                <div className="space-y-3 mt-8">
                                    <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <Clock className="w-4 h-4 text-green-600" />
                                        جدول الساعات المتاحة (يوم {new Date(appointmentDate).toLocaleDateString('ar-EG', { weekday: 'long' })})
                                    </label>
                                    
                                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-4">
                                        {timesForSelectedDate.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p className="font-bold">لا توجد مواعيد متاحة أو مسجلة في هذا اليوم</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {timesForSelectedDate.map((slot: any, idx: number) => {
                                                    const isBooked = slot.status === 'booked' || slot.status === 'unavailable';
                                                    const isBookedByMe = isBooked && slot.bookedBy && slot.bookedBy === currentUser?.id;
                                                    const isSelected = appointmentTimes.includes(slot.time);
                                                    
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            disabled={isBooked}
                                                            onClick={() => toggleTime(slot.time)}
                                                            className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                                                isBooked 
                                                                    ? 'bg-red-100 border-red-200 text-red-600 dark:bg-red-900/40 dark:border-red-800/50 dark:text-red-300 cursor-not-allowed opacity-90'
                                                                    : isSelected
                                                                        ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20 scale-105'
                                                                        : 'bg-card border-border hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'
                                                            }`}
                                                        >
                                                            {slot.time}
                                                            {isBookedByMe && <span className="block text-[11px] mt-1 text-red-600 dark:text-red-400 font-black">محجوز من قبلك</span>}
                                                            {isBooked && !isBookedByMe && <span className="block text-[11px] mt-1 text-red-600 dark:text-red-400 font-black">محجوز</span>}
                                                            {!isBooked && !isSelected && <span className="block text-[10px] mt-1 text-green-500">متاح للحجز</span>}
                                                            {isSelected && <span className="block text-[10px] mt-1 text-green-100">تم الاختيار</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Personal Info */}
                                <div className="space-y-4 pt-4 border-t border-border/50">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-muted-foreground">الاسم بالكامل</label>
                                        <Input
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="أدخل اسمك"
                                            className="h-12 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-muted-foreground">رقم الهاتف (اختياري)</label>
                                        <Input
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="01xxxxxxxxx"
                                            className="h-12 rounded-xl text-left"
                                            dir="ltr"
                                        />
                                        <p className="text-[10px] text-muted-foreground font-medium">لن يظهر رقم الهاتف لصاحب الملعب، وسيتم استخدام الاسم فقط لتأكيد الحجز.</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading || appointmentTimes.length === 0 || !customerName}
                                    className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-black font-cairo shadow-xl shadow-green-500/20 mt-4"
                                >
                                    {loading ? "جاري الحجز..." : "تأكيد الحجز"}
                                </Button>
                            </div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="py-12 text-center"
                            >
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                                </div>
                                <h3 className="text-2xl font-black text-green-600 mb-2 font-cairo">تم إرسال طلب الحجز بنجاح!</h3>
                                <p className="text-muted-foreground mb-8">
                                    تم تسجيل حجزك في ملعب "{provider.name}" ليوم {appointmentDate} الساعات: {appointmentTimes.join('، ')}.
                                    <br />
                                    في انتظار قبول صاحب الملعب لإشعارك بالتأكيد.
                                </p>
                                <Button
                                    onClick={handleClose}
                                    className="h-12 px-8 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                                >
                                    حسناً، فهمت
                                </Button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
