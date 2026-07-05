"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Calendar, Clock, Trophy, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

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

export function PlaygroundAppointmentsTab({ providerId, services, onServicesUpdated }: any) {
    const { toast } = useToast();
    const [allSavedSlots, setAllSavedSlots] = useState<any[]>([]); // All slots across all dates
    const [pricing, setPricing] = useState<{ morning: number; night: number }>({ morning: 0, night: 0 });
    
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    
    // State to hold the toggled slots for the *currently selected date*
    // Format: Record<string, 'available' | 'unavailable' | 'booked'> (key is time string)
    const [currentDayStatuses, setCurrentDayStatuses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Initialize all saved slots and pricing from the backend service
    useEffect(() => {
        const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
        if (availabilityService?.description) {
            try {
                const parsed = JSON.parse(availabilityService.description);
                if (Array.isArray(parsed)) {
                    // Backward compatibility: it was just an array of slots
                    setAllSavedSlots(parsed);
                } else if (parsed && typeof parsed === 'object') {
                    // New format: { slots: [], pricing: { morning, night } }
                    if (Array.isArray(parsed.slots)) setAllSavedSlots(parsed.slots);
                    if (parsed.pricing) setPricing({ morning: parsed.pricing.morning || 0, night: parsed.pricing.night || 0 });
                }
            } catch (e) {
                console.error("Failed to parse availability slots", e);
            }
        }
    }, [services]);

    // Whenever selectedDate or allSavedSlots changes, populate currentDayStatuses
    useEffect(() => {
        const statusesForDay: Record<string, string> = {};
        const slotsForDate = allSavedSlots.filter(s => s.date === selectedDate);
        
        slotsForDate.forEach(slot => {
            statusesForDay[slot.time] = slot.status;
        });

        setCurrentDayStatuses(statusesForDay);
    }, [selectedDate, allSavedSlots]);

    const handleToggleSlot = (time: string) => {
        setCurrentDayStatuses(prev => {
            const currentStatus = prev[time];
            
            // Default is 'available' (undefined in state)
            // Flow: undefined (available) -> 'unavailable' -> 'booked' -> undefined (available)
            // We only need to store 'unavailable' or 'booked' states.
            
            let newStatus;
            if (!currentStatus) {
                newStatus = 'unavailable'; // Clicking an available slot makes it unavailable
            } else if (currentStatus === 'unavailable') {
                newStatus = 'booked'; // Clicking an unavailable slot makes it booked
            } else if (currentStatus === 'booked') {
                newStatus = undefined; // Clicking a booked slot makes it available again
            }

            const updated = { ...prev };
            if (newStatus) {
                updated[time] = newStatus;
            } else {
                delete updated[time];
            }
            return updated;
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const otherDatesSlots = allSavedSlots.filter(s => s.date !== selectedDate);
            
            const newSlotsForDate = Object.entries(currentDayStatuses).map(([time, status]) => ({
                date: selectedDate,
                time,
                status
            }));

            const finalSlots = [...otherDatesSlots, ...newSlotsForDate];
            const updatedDescription = JSON.stringify({ slots: finalSlots, pricing });

            const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
            const serviceData = {
                name: '__AVAILABILITY__',
                description: updatedDescription,
                price: Math.max(pricing.morning, pricing.night) || 0, // save the highest as base price just in case
                is_active: false // Hidden service
            };

            if (availabilityService) {
                await apiCall(`/services/${availabilityService.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(serviceData)
                });
            } else {
                await apiCall(`/services`, {
                    method: 'POST',
                    body: JSON.stringify({ ...serviceData, providerId })
                });
            }

            setAllSavedSlots(finalSlots);
            toast("تم حفظ الإعدادات لهذا اليوم بنجاح", "success");
            if (onServicesUpdated) onServicesUpdated();
        } catch (error) {
            console.error('Failed to save availability:', error);
            toast("حدث خطأ أثناء الحفظ", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Pricing Section */}
            <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    تسعيرة الملعب
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground">سعر الساعة (صباحاً)</label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="0"
                                value={pricing.morning || ''}
                                onChange={(e) => setPricing(p => ({ ...p, morning: Number(e.target.value) }))}
                                placeholder="مثال: 100"
                                className="pl-10 h-12"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground">يُطبق على أي ساعة تحتوي على (ص)</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground">سعر الساعة (مساءً)</label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="0"
                                value={pricing.night || ''}
                                onChange={(e) => setPricing(p => ({ ...p, night: Number(e.target.value) }))}
                                placeholder="مثال: 150"
                                className="pl-10 h-12"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">ج.م</span>
                        </div>
                        <p className="text-xs text-muted-foreground">يُطبق على أي ساعة تحتوي على (م)</p>
                    </div>
                </div>
                <p className="text-xs font-bold text-green-600 mt-4">
                    * ملاحظة: إذا قمت بتحديد سعر واحد فقط (مثلاً في الصباح) وترك الآخر فارغاً، سيتم تطبيقه على جميع الساعات.
                </p>
            </div>

            {/* Header: Date Selection & Save */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                <div className="space-y-2 w-full md:w-1/3">
                    <label className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500" />
                        اختر التاريخ
                    </label>
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-11"
                    />
                </div>
                <div className="w-full md:w-auto flex flex-col items-end gap-2">
                    <Button 
                        onClick={handleSave} 
                        disabled={loading || !selectedDate}
                        className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto px-8 font-bold"
                    >
                        <Save className="w-5 h-5 ml-2" />
                        {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
                    </Button>
                    <p className="text-xs text-muted-foreground">اضغط على الساعة لتغيير حالتها</p>
                </div>
            </div>

            {/* 24-Hour Grid */}
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    جدول الـ 24 ساعة (يوم {new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long' })})
                </h3>
                
                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-border/50 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                        <span>متاح للحجز (الافتراضي)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-muted/50 border border-border"></div>
                        <span>غير متاح / معطل</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500 border border-red-600"></div>
                        <span>مشغول / محجوز</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {ALL_DAY_SLOTS.map((time) => {
                        const status = currentDayStatuses[time];
                        
                        let btnClass = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300 shadow-sm shadow-green-500/10 hover:bg-green-200 dark:hover:bg-green-800";
                        let statusText = "متاح";

                        if (status === 'unavailable') {
                            btnClass = "bg-muted/30 border-border/50 text-foreground hover:bg-muted/50";
                            statusText = "غير متاح";
                        } else if (status === 'booked') {
                            btnClass = "bg-red-500 border-red-600 text-white shadow-sm shadow-red-500/20 opacity-90";
                            statusText = "محجوز";
                        }

                        return (
                            <button
                                key={time}
                                onClick={() => handleToggleSlot(time)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all font-bold ${btnClass}`}
                            >
                                <span className="text-[13px] dir-ltr">{time}</span>
                                <span className="text-[10px] mt-1 opacity-80">{statusText}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
