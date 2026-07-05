"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Calendar, Clock, Trophy } from "lucide-react";
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
    
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    
    // State to hold the toggled slots for the *currently selected date*
    // Format: Record<string, 'available' | 'unavailable' | 'booked'> (key is time string)
    const [currentDayStatuses, setCurrentDayStatuses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Initialize all saved slots from the backend service
    useEffect(() => {
        const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
        if (availabilityService?.description) {
            try {
                const parsed = JSON.parse(availabilityService.description);
                if (Array.isArray(parsed)) {
                    setAllSavedSlots(parsed);
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
            
            // If it's booked, the provider shouldn't easily toggle it off without a warning, 
            // but for simplicity, let's allow them to toggle it to 'available' or 'unavailable'.
            // Flow: undefined -> available -> unavailable -> undefined
            
            let newStatus;
            if (!currentStatus) {
                newStatus = 'available';
            } else if (currentStatus === 'available') {
                newStatus = 'unavailable';
            } else {
                // If it's unavailable or booked, clicking it will reset it or make it available
                // Let's just reset it to undefined (not set)
                newStatus = undefined;
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
            // First, remove all slots for the currently selected date from allSavedSlots
            const otherDatesSlots = allSavedSlots.filter(s => s.date !== selectedDate);
            
            // Build the new slots for the selected date based on currentDayStatuses
            const newSlotsForDate = Object.entries(currentDayStatuses).map(([time, status]) => ({
                date: selectedDate,
                time,
                status
            }));

            // Merge them
            const finalSlots = [...otherDatesSlots, ...newSlotsForDate];

            const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
            const serviceData = {
                name: '__AVAILABILITY__',
                description: JSON.stringify(finalSlots),
                price: 0,
                is_active: false // Hidden service
            };

            if (availabilityService) {
                await apiCall(`/providers/${providerId}/services/${availabilityService.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(serviceData)
                });
            } else {
                await apiCall(`/providers/${providerId}/services`, {
                    method: 'POST',
                    body: JSON.stringify(serviceData)
                });
            }

            setAllSavedSlots(finalSlots);
            toast("تم حفظ المواعيد لهذا اليوم بنجاح", "success");
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
            {/* Header: Date Selection & Save */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                <div className="space-y-2 w-full md:w-1/3">
                    <label className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500" />
                        اختر التاريخ
                    </label>
                    <Input
                        type="date"
                        min={today}
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
                        {loading ? "جاري الحفظ..." : "حفظ مواعيد هذا اليوم"}
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
                        <div className="w-4 h-4 rounded bg-muted/50 border border-border"></div>
                        <span>غير محدد</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                        <span>متاح للحجز</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500 border border-red-600"></div>
                        <span>مشغول / محجوز</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {ALL_DAY_SLOTS.map((time) => {
                        const status = currentDayStatuses[time];
                        
                        let btnClass = "bg-muted/30 border-border/50 text-foreground hover:bg-muted/50"; // default
                        let statusText = "غير محدد";

                        if (status === 'available') {
                            btnClass = "bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300 shadow-sm shadow-green-500/10";
                            statusText = "متاح";
                        } else if (status === 'unavailable') {
                            btnClass = "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-700 dark:text-red-300 shadow-sm shadow-red-500/10";
                            statusText = "غير متاح";
                        } else if (status === 'booked') {
                            btnClass = "bg-red-500 border-red-600 text-white shadow-sm shadow-red-500/20 opacity-90";
                            statusText = "محجوز عبر التطبيق";
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
