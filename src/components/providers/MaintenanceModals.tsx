"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Clock, Calendar as CalendarIcon, Check, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { arEG } from 'date-fns/locale';

interface RescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => Promise<void>;
    currentDate?: string | Date;
}

export function RescheduleModal({ isOpen, onClose, onConfirm, currentDate }: RescheduleModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(currentDate ? new Date(currentDate) : undefined);
    const [selectedTime, setSelectedTime] = useState<string>("12:00");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!selectedDate) return;

        setIsSubmitting(true);
        try {
            // Combine date and time
            const finalDate = new Date(selectedDate);
            const [hours, minutes] = selectedTime.split(':').map(Number);
            finalDate.setHours(hours, minutes);

            await onConfirm(finalDate);
            onClose();
        } catch (error) {
            console.error("Failed to reschedule:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-card border-border rounded-[2rem] p-6">
                <DialogHeader className="border-b border-border/50 pb-4 mb-4">
                    <DialogTitle className="text-xl font-black font-cairo text-right">تغيير الموعد</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-right block font-bold text-muted-foreground mb-2">اختر اليوم</Label>
                        <div className="border border-border/50 rounded-2xl p-4 bg-muted/20 flex justify-center shadow-inner">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                className="rounded-md w-full"
                                classNames={{
                                    head_cell: "text-muted-foreground rounded-md w-10 font-bold text-xs shrink-0",
                                    cell: "h-10 w-10 text-center text-sm p-0 relative shrink-0",
                                    day: "h-10 w-10 p-0 font-bold hover:bg-primary/10 transition-colors",
                                    day_selected: "bg-primary text-white hover:bg-primary hover:text-white rounded-lg shadow-lg shadow-primary/30",
                                    table: "w-full border-collapse space-y-1",
                                    head_row: "flex justify-between",
                                    row: "flex w-full mt-2 justify-between",
                                }}
                                locale={arEG}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-right block font-bold text-muted-foreground mb-2">اختر الساعة</Label>
                        <div className="relative group">
                            <Input
                                type="time"
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                className="h-14 text-center text-xl font-black bg-background border-border/50 rounded-2xl px-12 transition-all group-hover:border-primary/50 focus:ring-primary/20"
                            />
                            <Clock className="absolute right-4 top-4 w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-6 gap-2">
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedDate || isSubmitting}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl"
                    >
                        {isSubmitting ? 'جاري الحفظ...' : 'تأكيد الموعد الجديد'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 border-border font-bold h-12 rounded-xl"
                    >
                        إلغاء
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface PriceEstimationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (price: number) => Promise<void>;
}

export function PriceEstimationModal({ isOpen, onClose, onConfirm }: PriceEstimationModalProps) {
    const [price, setPrice] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice <= 0) return;

        setIsSubmitting(true);
        try {
            await onConfirm(numPrice);
            onClose();
        } catch (error) {
            console.error("Failed to set price:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-sm bg-card border-border rounded-[2rem] p-6">
                <DialogHeader className="border-b border-border/50 pb-4 mb-4">
                    <DialogTitle className="text-xl font-black font-cairo text-right">تقدير التكلفة</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-right">
                    <p className="text-muted-foreground font-medium text-sm">
                        هذه الخدمة تتطلب معاينة أو تقدير سعر. هل يمكنك تحديد تكلفة مبدئية للعميل؟
                    </p>

                    <div className="relative">
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.00"
                            className="h-14 text-center text-2xl font-black bg-background border-border rounded-xl"
                            autoFocus
                        />
                        <span className="absolute left-4 top-4 text-muted-foreground font-bold">ج.م</span>
                        <DollarSign className="absolute right-4 top-4 text-muted-foreground w-6 h-6" />
                    </div>
                </div>

                <DialogFooter className="mt-6 gap-2">
                    <Button
                        onClick={handleConfirm}
                        disabled={!price || parseFloat(price) <= 0 || isSubmitting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl"
                    >
                        {isSubmitting ? 'جاري التأكيد...' : 'تأكيد وقبول الطلب'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 border-border font-bold h-12 rounded-xl"
                    >
                        إلغاء
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
