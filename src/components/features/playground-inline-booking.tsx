"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Calendar, Clock, Trophy, MapPin, Check, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

const generateDaySlots = () => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
        const start = i;
        const end = (i + 1) % 24;
        
        const formatHour = (h: number) => {
            const ampm = h >= 12 ? 'م' : 'ص';
            const hour12 = h % 12 || 12;
            return `${hour12.toString().padStart(2, '0')}:00 ${ampm}`;
        };
        slots.push(`${formatHour(start)} - ${formatHour(end)}`);
    }
    return slots;
};

const ALL_DAY_SLOTS = generateDaySlots();

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
    const [appointmentTimes, setAppointmentTimes] = useState<string[]>([]);
    
    // Extract availability and pricing
    const availabilityService = provider.services?.find(s => s.name === '__AVAILABILITY__');
    const { allSavedSlots, pricing } = useMemo(() => {
        let slots: any[] = [];
        let pr = { morning: 0, night: 0, nightStartHour: "06:00 م", nightEndHour: "06:00 ص" };
        
        if (!availabilityService?.description) return { allSavedSlots: slots, pricing: pr };
        try {
            const parsed = JSON.parse(availabilityService.description);
            if (Array.isArray(parsed)) {
                slots = parsed;
            } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.slots)) slots = parsed.slots;
                if (parsed.pricing) {
                    pr = { 
                        morning: parsed.pricing.morning || 0, 
                        night: parsed.pricing.night || 0,
                        nightStartHour: parsed.pricing.nightStartHour || "06:00 م",
                        nightEndHour: parsed.pricing.nightEndHour || "06:00 ص"
                    };
                }
            }
        } catch (e) {
            console.error("Failed to parse availability", e);
        }
        return { allSavedSlots: slots, pricing: pr };
    }, [availabilityService]);

    const timesForSelectedDate = useMemo(() => {
        if (!appointmentDate) return {};
        const statuses: Record<string, string> = {};
        allSavedSlots.filter((s: any) => s.date === appointmentDate).forEach((slot: any) => {
            statuses[slot.time] = slot.status;
        });
        return statuses;
    }, [appointmentDate, allSavedSlots]);

    const isNightTime = (timeStr: string) => {
        const parseHourStr = (str: string) => {
            if (!str) return 0;
            const [hourStr, ampm] = str.split(' ');
            let hour = parseInt(hourStr.split(':')[0], 10);
            if (ampm === 'م' && hour !== 12) hour += 12;
            if (ampm === 'ص' && hour === 12) hour = 0;
            return hour;
        };

        const slotStartHourStr = timeStr.split(' - ')[0];
        const slotHour = parseHourStr(slotStartHourStr);
        const startNight = parseHourStr(pricing.nightStartHour);
        const endNight = parseHourStr(pricing.nightEndHour);

        if (startNight <= endNight) {
            return slotHour >= startNight && slotHour < endNight;
        } else {
            // crosses midnight (e.g., 20 to 5)
            return slotHour >= startNight || slotHour < endNight;
        }
    };

    // Calculate total price based on selected times
    const totalPrice = useMemo(() => {
        let total = 0;
        const fallbackPrice = pricing.morning || pricing.night || 0;
        
        appointmentTimes.forEach(time => {
            const isNight = isNightTime(time);
            if (pricing.morning && pricing.night) {
                total += isNight ? pricing.night : pricing.morning;
            } else {
                total += fallbackPrice;
            }
        });
        return total;
    }, [appointmentTimes, pricing]);

    const handleToggleTime = (time: string) => {
        setAppointmentTimes(prev => {
            if (prev.includes(time)) {
                return prev.filter(t => t !== time);
            } else {
                return [...prev, time].sort((a, b) => ALL_DAY_SLOTS.indexOf(a) - ALL_DAY_SLOTS.indexOf(b));
            }
        });
    };

    const handleSubmit = async () => {
        if (!customerName || !appointmentDate || appointmentTimes.length === 0) {
            toast("يرجى ملء جميع الحقول المطلوبة واختيار وقت واحد على الأقل", "error");
            return;
        }

        setLoading(true);
        try {
            const finalServiceName = `حجز ملعب (${appointmentTimes.length} ساعات)`;
            const detailsStr = `الاسم: ${customerName} | الموعد: ${appointmentDate} | الساعات: ${appointmentTimes.join(' و ')}`;

            await apiCall('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser?.id || null,
                    providerId: provider.id,
                    providerName: provider.name || "ملعب",
                    serviceId: null,
                    userName: customerName,
                    phone: phone || "0000000000",
                    address: "حجز ملعب",
                    location: "ملاعب",
                    serviceName: finalServiceName,
                    details: detailsStr,
                    price: totalPrice,
                    appointmentDate: new Date(`${appointmentDate}T00:00:00`).toISOString(),
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
                                onChange={(e) => {
                                    setAppointmentDate(e.target.value);
                                    setAppointmentTimes([]); // Reset time on date change
                                }}
                                className="h-14 rounded-2xl bg-muted/50 border-transparent focus:border-green-500 focus:bg-background text-lg font-bold max-w-sm"
                            />
                        </div>

                        {/* 24-Hour Time Grid */}
                        <div className="space-y-3 mt-8">
                            <label className="text-sm font-bold flex items-center gap-2 text-foreground mb-4">
                                <Clock className="w-4 h-4 text-green-600" />
                                جدول الساعات المتاحة (يوم {new Date(appointmentDate).toLocaleDateString('ar-EG', { weekday: 'long' })})
                            </label>
                            
                            <div className="bg-muted/30 border border-border/50 rounded-2xl p-6">
                                {/* Legend */}
                                <div className="flex flex-wrap items-center gap-6 mb-6 pb-6 border-b border-border/50 text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                                        <span>متاح للحجز</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-muted/50 border border-border"></div>
                                        <span>غير متوفر</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-500 border border-red-600"></div>
                                        <span>محجوز مسبقاً</span>
                                    </div>
                                </div>

                                {/* Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {ALL_DAY_SLOTS.map((time, idx) => {
                                        const status = timesForSelectedDate[time]; // 'available', 'unavailable', 'booked', or undefined
                                        const isAvailable = status !== 'unavailable' && status !== 'booked';
                                        const isSelected = appointmentTimes.includes(time);
                                        const isBooked = status === 'booked';
                                        
                                        // Check if the time slot has already passed today
                                        let isPast = false;
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        if (appointmentDate === todayStr) {
                                            const startPart = time.split(' - ')[0]; // "01:00 م"
                                            const [hourStr, ampm] = startPart.split(' ');
                                            let hours = parseInt(hourStr.split(':')[0], 10);
                                            if (ampm === 'م' && hours !== 12) hours += 12;
                                            if (ampm === 'ص' && hours === 12) hours = 0;
                                            
                                            const currentHour = new Date().getHours();
                                            if (hours <= currentHour) {
                                                isPast = true;
                                            }
                                        }

                                        let btnClass = "bg-muted/30 border-border/50 text-muted-foreground opacity-60 cursor-not-allowed";
                                        let statusText = "غير متوفر";

                                        if (isSelected) {
                                            btnClass = "bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20 scale-105 ring-2 ring-green-600 ring-offset-2 ring-offset-background";
                                            statusText = "تم الاختيار";
                                        } else if (isBooked) {
                                            btnClass = "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 opacity-70 cursor-not-allowed";
                                            statusText = "محجوز";
                                        } else if (isPast) {
                                            btnClass = "bg-muted/30 border-border/50 text-muted-foreground opacity-60 cursor-not-allowed";
                                            statusText = "انتهى الوقت";
                                        } else if (isAvailable) {
                                            btnClass = "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:border-green-500 hover:bg-green-100 dark:hover:bg-green-900/40 cursor-pointer shadow-sm";
                                            statusText = "متاح للحجز";
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                disabled={(!isAvailable || isPast) && !isSelected}
                                                onClick={() => handleToggleTime(time)}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all font-bold ${btnClass}`}
                                            >
                                                <span className="text-[13px] dir-ltr">{time}</span>
                                                <span className="text-[10px] mt-1 font-medium flex items-center gap-1">
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                    {statusText}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Total Price Section */}
                                <AnimatePresence>
                                    {appointmentTimes.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 flex justify-between items-center"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                                                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-green-800 dark:text-green-300">التكلفة الإجمالية</p>
                                                    <p className="text-xs text-green-600/80 dark:text-green-400/80">لعدد {appointmentTimes.length} ساعات مختارة</p>
                                                </div>
                                            </div>
                                            <div className="text-2xl font-black text-green-700 dark:text-green-400 font-cairo">
                                                {totalPrice} ج.م
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
                            disabled={loading || appointmentTimes.length === 0 || !customerName}
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
                            تم تسجيل حجزك في ملعب "{provider.name}" ليوم {appointmentDate}.
                            <br />
                            الساعات: {appointmentTimes.join(' و ')}
                            <br />
                            التكلفة: {totalPrice} ج.م
                            <br />
                            في انتظار تأكيد الحجز من صاحب الملعب.
                        </p>
                        <Button
                            onClick={() => {
                                setStep(1);
                                setAppointmentTimes([]);
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
