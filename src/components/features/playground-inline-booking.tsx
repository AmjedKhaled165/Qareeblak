"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Calendar, Clock, Trophy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface PlaygroundInlineBookingProps {
    provider: {
        id: string;
        name: string;
        category: string;
        services?: any[];
        location?: string;
    };
}

export function PlaygroundInlineBooking({ provider }: PlaygroundInlineBookingProps) {
    const { toast } = useToast();
    const { currentUser } = useAppStore();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [customerName, setCustomerName] = useState(currentUser?.name || "");
    const [phone, setPhone] = useState(currentUser?.phone || "");
    const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [appointmentTime, setAppointmentTime] = useState("");
    
    // Extract availability
    const availabilityService = provider.services?.find(s => s.name === '__AVAILABILITY__');
    const allSlots = useMemo(() => {
        if (!availabilityService?.description) return [];
        try {
            const parsed = JSON.parse(availabilityService.description);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }, [availabilityService]);

    const timesForSelectedDate = useMemo(() => {
        if (!appointmentDate) return [];
        return allSlots.filter((s: any) => s.date === appointmentDate);
    }, [appointmentDate, allSlots]);

    const handleSubmit = async () => {
        if (!customerName || !appointmentDate || !appointmentTime) {
            toast("يرجى ملء جميع الحقول المطلوبة واختيار وقت", "error");
            return;
        }

        setLoading(true);
        try {
            const finalServiceName = `حجز ملعب`;
            const detailsStr = `الاسم: ${customerName} | الموعد: ${appointmentDate} ${appointmentTime}`;

            await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    serviceId: null,
                    userName: customerName,
                    phone: phone || "0000000000",
                    address: "حجز ملعب",
                    location: "ملاعب",
                    serviceName: finalServiceName,
                    details: detailsStr,
                    price: 0,
                    appointmentDate: `${appointmentDate}T00:00:00`,
                    appointmentType: 'playground'
                })
            });

            // If successful, we must also mark the slot as booked
            if (availabilityService) {
                const updatedSlots = allSlots.map((slot: any) => {
                    if (slot.date === appointmentDate && slot.time === appointmentTime) {
                        return { ...slot, status: 'booked' };
                    }
                    return slot;
                });
                await apiCall(`/providers/${provider.id}/services/${availabilityService.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: '__AVAILABILITY__',
                        description: JSON.stringify(updatedSlots),
                        price: 0,
                        is_active: false
                    })
                });
            }

            setStep(2); // Success step
        } catch (error) {
            console.error('Booking failed:', error);
            toast("حدث خطأ أثناء الحجز، يرجى المحاولة مرة أخرى", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="overflow-hidden border border-border shadow-sm bg-card rounded-3xl mt-4">
            <div className="bg-green-600 p-6 text-white relative shrink-0">
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

            <CardContent className="p-6 md:p-8">
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
                                className="h-14 rounded-2xl bg-muted/50 border-transparent focus:border-green-500 focus:bg-background text-lg font-bold max-w-sm"
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
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {timesForSelectedDate.map((slot: any, idx: number) => {
                                            const isBooked = slot.status === 'booked' || slot.status === 'unavailable';
                                            const isSelected = appointmentTime === slot.time;
                                            
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={isBooked}
                                                    onClick={() => setAppointmentTime(slot.time)}
                                                    className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                                        isBooked 
                                                            ? 'bg-red-50 border-red-100 text-red-400 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-800 cursor-not-allowed opacity-60'
                                                            : isSelected
                                                                ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20 scale-105'
                                                                : 'bg-card border-border hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'
                                                    }`}
                                                >
                                                    {slot.time}
                                                    {isBooked && <span className="block text-[10px] mt-1 text-red-500">غير متوفر</span>}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
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
                            </div>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !appointmentTime || !customerName}
                            className="w-full md:w-auto min-w-[200px] h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-black font-cairo shadow-xl shadow-green-500/20 mt-4"
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
                            تم تسجيل حجزك في ملعب "{provider.name}" ليوم {appointmentDate} الساعة {appointmentTime}.
                            <br />
                            في انتظار تأكيد الحجز من صاحب الملعب.
                        </p>
                        <Button
                            onClick={() => {
                                setStep(1);
                                setAppointmentTime("");
                            }}
                            className="h-12 px-8 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                        >
                            حجز موعد آخر
                        </Button>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}
