"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Calendar, Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

export function PlaygroundAppointmentsTab({ providerId, services, onServicesUpdated }: any) {
    const { toast } = useToast();
    const [slots, setSlots] = useState<any[]>([]);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [status, setStatus] = useState("available");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
        if (availabilityService?.description) {
            try {
                const parsed = JSON.parse(availabilityService.description);
                if (Array.isArray(parsed)) {
                    setSlots(parsed);
                }
            } catch (e) {
                console.error("Failed to parse availability slots", e);
            }
        }
    }, [services]);

    const handleAddSlot = () => {
        if (!date || !time) {
            toast("يرجى تحديد التاريخ والوقت", "error");
            return;
        }

        const newSlot = { date, time, status };
        
        // Prevent duplicates
        if (slots.some(s => s.date === date && s.time === time)) {
            toast("هذا الموعد موجود بالفعل", "error");
            return;
        }

        setSlots([...slots, newSlot]);
        setDate("");
        setTime("");
        setStatus("available");
    };

    const handleRemoveSlot = (index: number) => {
        const newSlots = [...slots];
        newSlots.splice(index, 1);
        setSlots(newSlots);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const availabilityService = services?.find((s: any) => s.name === '__AVAILABILITY__');
            
            const serviceData = {
                name: '__AVAILABILITY__',
                description: JSON.stringify(slots),
                price: 0,
                is_active: false // Hidden service
            };

            if (availabilityService) {
                // Update
                await apiCall(`/providers/${providerId}/services/${availabilityService.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(serviceData)
                });
            } else {
                // Create
                await apiCall(`/providers/${providerId}/services`, {
                    method: 'POST',
                    body: JSON.stringify(serviceData)
                });
            }

            toast("تم حفظ إدارة المواعيد بنجاح", "success");
            if (onServicesUpdated) onServicesUpdated();
        } catch (error) {
            console.error('Failed to save availability:', error);
            toast("حدث خطأ أثناء الحفظ", "error");
        } finally {
            setLoading(false);
        }
    };

    // Sort slots by date and time
    const sortedSlots = [...slots].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
    });

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                <div className="space-y-2 flex-1 w-full md:w-1/4">
                    <label className="text-sm font-bold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500" />
                        التاريخ
                    </label>
                    <Input
                        type="date"
                        min={today}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-11"
                    />
                </div>
                <div className="space-y-2 flex-1 w-full md:w-1/4">
                    <label className="text-sm font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        الوقت (من - إلى)
                    </label>
                    <Input
                        type="text"
                        placeholder="مثال: 10:00 - 12:00"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="h-11 text-right"
                        dir="ltr"
                    />
                </div>
                <div className="space-y-2 flex-1 w-full md:w-1/4">
                    <label className="text-sm font-bold flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-green-500" />
                        حالة الموعد
                    </label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="available">متاح للحجز</option>
                        <option value="unavailable">غير متاح (مغلق/محجوز)</option>
                    </select>
                </div>
                <Button 
                    onClick={handleAddSlot}
                    className="h-11 bg-green-600 hover:bg-green-700 text-white w-full md:w-auto px-6"
                >
                    <Plus className="w-5 h-5 ml-1" />
                    إضافة موعد
                </Button>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
                    <h3 className="font-bold text-lg">المواعيد المضافة</h3>
                    <Button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="sm"
                    >
                        <Save className="w-4 h-4 ml-1" />
                        {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
                    </Button>
                </div>
                
                {sortedSlots.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20 text-green-500" />
                        <p>لم يتم إضافة أي مواعيد (متاحة أو غير متاحة) للملعب بعد.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {sortedSlots.map((slot, idx) => (
                            <div key={idx} className="p-4 flex justify-between items-center hover:bg-muted/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {slot.date}
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {slot.time}
                                    </div>
                                    {slot.status === 'booked' && (
                                        <div className="bg-red-100 text-red-700 px-2 py-1 text-xs rounded-md font-bold">
                                            محجوز
                                        </div>
                                    )}
                                    {slot.status === 'unavailable' && (
                                        <div className="bg-slate-200 text-slate-600 px-2 py-1 text-xs rounded-md font-bold border border-slate-300">
                                            غير متاح
                                        </div>
                                    )}
                                    {slot.status === 'available' && (
                                        <div className="bg-emerald-100 text-emerald-700 px-2 py-1 text-xs rounded-md font-bold border border-emerald-200">
                                            متاح
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => handleRemoveSlot(slots.indexOf(slot))}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
