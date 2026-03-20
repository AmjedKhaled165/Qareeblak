"use client";

import React from 'react';
import {
    MapPin, Phone, Calendar, Clock, User, MessageSquare,
    Check, X as CloseIcon, Package as PackageIcon, Wrench
} from 'lucide-react';
import { isMaintenanceProvider } from '@/lib/category-utils';

interface Booking {
    id: string;
    userId?: string | number;
    userName: string;
    serviceName: string;
    providerName: string;
    providerId?: string;
    status: 'pending' | 'pending_appointment' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'provider_rescheduled' | 'customer_rescheduled';
    date?: string;
    details?: string;
    items?: any[];
    price?: number;
    halanOrderId?: number;
    appointmentDate?: string;
    appointmentType?: string;
    lastUpdatedBy?: 'provider' | 'customer';
}

interface OrderDetailModalProps {
    booking: Booking | null;
    isOpen: boolean;
    onClose: () => void;
    onAccept: (booking: Booking) => void;
    onReschedule: (booking: Booking) => void;
    onReject: (bookingId: string) => void;
    onComplete: (bookingId: string) => void;
    onAcceptAppointment?: (bookingId: string) => void;
    isPharmacy: boolean;
    onOpenChat?: (booking: Booking) => void;
    servicePrice?: number;
    providerCategory?: string;
    isManualOrder?: boolean;
}

// Helper: calculate actual price from booking
function getBookingPrice(booking: Booking): number {
    // 1. Try structured price
    if (Number(booking.price) > 0) return Number(booking.price);

    // 2. Try to sum from items
    let itemsArr: any[] = [];
    try {
        itemsArr = Array.isArray(booking.items) ? booking.items : JSON.parse(booking.items || "[]");
    } catch (e) { }

    if (itemsArr && itemsArr.length > 0) {
        const itemsTotal = itemsArr.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        if (itemsTotal > 0) return itemsTotal;
    }

    // 3. Fallback: regex from details
    return Number(booking.details?.match(/الإجمالي:\s*(\d+)/)?.[1]) || 0;
}

// Helper: extract phone from details
function extractPhone(details: string): string | null {
    const match = details.match(/الهاتف:\s*(01[0-9]{9})/);
    return match ? match[1] : null;
}

// Helper to fix mangled UTF-8 text (Mojibake)
function fixMangledText(str: string) {
    if (!str) return str;
    try {
        if (/[\u0080-\u00FF]/.test(str)) {
            return decodeURIComponent(escape(str));
        }
        return str;
    } catch (e) {
        return str;
    }
}

// Helper: extract address from details
function extractAddress(details: string): string | null {
    const match = details.match(/العنوان:\s*([^|]+)/);
    return match ? fixMangledText(match[1].trim()) : null;
}

// Helper: status badge config
function getStatusConfig(status: string) {
    switch (status) {
        case 'pending':
        case 'pending_appointment':
            return { label: status === 'pending' ? 'جديد' : 'بانتظار الموعد', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', dot: 'bg-amber-500' };
        case 'provider_rescheduled':
            return { label: 'بانتظار رد العميل', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', dot: 'bg-blue-500' };
        case 'customer_rescheduled':
            return { label: 'العميل اقترح موعداً', bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20', dot: 'bg-purple-500' };
        case 'confirmed':
            return { label: 'جاري التنفيذ', bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/20', dot: 'bg-indigo-500' };
        case 'completed':
            return { label: 'مكتمل', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', dot: 'bg-emerald-500' };
        case 'cancelled':
            return { label: 'ملغي من العميل', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', dot: 'bg-red-500' };
        case 'rejected':
            return { label: 'مرفوض', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' };
        default:
            return { label: status, bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border/50', dot: 'bg-muted-foreground' };
    }
}

export function OrderDetailModal({
    booking, isOpen, onClose, onAccept, onReschedule, onReject, onComplete, isPharmacy, onOpenChat, servicePrice, onAcceptAppointment, providerCategory, isManualOrder
}: OrderDetailModalProps) {
    if (!booking) return null;
    if (!isOpen) return null;

    const details = booking.details || "";
    const phone = extractPhone(details);
    const address = extractAddress(details);
    const price = getBookingPrice(booking);
    const isMaintenance = booking.appointmentType === 'maintenance';
    const statusConfig = getStatusConfig(booking.status);
    const isPending = booking.status === 'pending' || booking.status === 'pending_appointment' || booking.status === 'customer_rescheduled';
    const isConfirmed = booking.status === 'confirmed';
    const isArchived = booking.status === 'completed' || booking.status === 'rejected' || booking.status === 'cancelled';
    
    // Phone Privacy Rules:
    // Maintenance/Plumbing providers → ALWAYS show phone
    // Food/Pharmacy/Market providers → NEVER show phone (use chat/app call)
    const isMaintenanceCategory = isMaintenanceProvider(providerCategory);
    const showPhone = isMaintenanceCategory ? !!phone : false;
    const showPhoneMessage = isMaintenanceCategory 
        ? null 
        : '****** (يظهر للمندوب فقط)';
    
    // Manual orders cannot be rejected by providers
    const isManual = isManualOrder || booking.serviceName?.includes('طلب يدوي');
    const canReject = !isManual;

    // Parse items
    let itemsArr: any[] = [];
    try {
        itemsArr = Array.isArray(booking.items) ? booking.items : JSON.parse(booking.items || "[]");
    } catch (e) { }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className="max-w-2xl w-full max-h-[92vh] overflow-hidden bg-card border border-border rounded-[2rem] p-0 text-foreground flex flex-col gap-0"
                onClick={(e) => e.stopPropagation()}
            >

                {/* ===== HEADER ===== */}
                <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border/50 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isMaintenance ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                            {isMaintenance ? <Wrench className="w-6 h-6" /> : <PackageIcon className="w-6 h-6" />}
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-black font-cairo text-foreground">
                                طلب #{booking.id.substring(0, 8)}
                            </h2>
                            <p className="text-sm font-bold text-muted-foreground mt-0.5">
                                {booking.serviceName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                            <span className={`w-2 h-2 rounded-full ${statusConfig.dot} animate-pulse`}></span>
                            {statusConfig.label}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
                            title="إغلاق"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ===== SCROLLABLE BODY ===== */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

                    {/* --- Customer Section --- */}
                    <div className="bg-muted/30 rounded-2xl p-5 border border-border/50">
                        <h3 className="text-xs font-black text-muted-foreground mb-4 font-cairo flex items-center gap-2">
                            <User className="w-4 h-4" /> بيانات العميل
                        </h3>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl border border-primary/20">
                                    {booking.userName?.[0] || '؟'}
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg text-foreground font-cairo">{booking.userName}</p>
                                    {showPhone && phone ? (
                                        <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:underline mt-1 transition-colors">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span dir="ltr">{phone}</span>
                                        </a>
                                    ) : (
                                        showPhoneMessage && (
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 bg-muted px-2 py-1 rounded-lg">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                {showPhoneMessage}
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {showPhone && phone && (
                                    <a href={`tel:${phone}`} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20" title="اتصال">
                                        <Phone className="w-5 h-5" />
                                    </a>
                                )}
                                {isPharmacy && onOpenChat && booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                                    <button onClick={() => onOpenChat(booking)} className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/20 transition-all border border-blue-500/20" title="محادثة">
                                        <MessageSquare className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- Location Section --- */}
                    {address && (
                        <div className="bg-muted/30 rounded-2xl p-5 border border-border/50">
                            <h3 className="text-xs font-black text-muted-foreground mb-3 font-cairo flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> العنوان
                            </h3>
                            <p className="text-foreground font-bold text-base leading-relaxed mb-4">{address}</p>

                        </div>
                    )}

                    {/* --- Appointment Card (Maintenance Only) --- */}
                    {isMaintenance && booking.appointmentDate && (
                        <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20 rounded-2xl p-5 border border-blue-200/50 dark:border-blue-800/30">
                            <h3 className="text-xs font-black text-blue-500 mb-3 font-cairo flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> الموعد المحدد
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-500/10 p-4 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    <Calendar className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-blue-900 dark:text-blue-100 font-cairo">
                                        {new Date(booking.appointmentDate).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 text-blue-700 dark:text-blue-300">
                                        <Clock className="w-4 h-4" />
                                        <span className="font-black text-base">
                                            {new Date(booking.appointmentDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- Items List (if any) --- */}
                    {itemsArr.length > 0 && (
                        <div className="bg-muted/30 rounded-2xl p-5 border border-border/50">
                            <h3 className="text-xs font-black text-muted-foreground mb-3 font-cairo flex items-center gap-2">
                                <PackageIcon className="w-4 h-4" /> المنتجات
                            </h3>
                            <div className="space-y-2">
                                {itemsArr.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-background/60 rounded-xl border border-border/30">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-primary/40"></span>
                                            <span className="font-bold text-foreground text-sm">{item.name || item.product_name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground font-bold">x{item.quantity}</span>
                                            {Number(item.price) > 0 && (
                                                <span className="text-xs font-black text-primary">{Number(item.price) * Number(item.quantity || 1)} ج.م</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- Pricing Section --- */}
                    <div className="bg-muted/30 rounded-2xl p-5 border border-border/50">
                        <h3 className="text-xs font-black text-muted-foreground mb-3 font-cairo">💰 التكلفة</h3>
                        {price > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="text-4xl font-black text-foreground">{price}</span>
                                <span className="text-lg font-bold text-muted-foreground">ج.م</span>
                            </div>
                        ) : servicePrice ? (
                            <div className="flex items-center gap-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-5 py-4 rounded-xl">
                                <span className="text-3xl font-black">{servicePrice}</span>
                                <span className="text-lg font-bold">ج.م</span>
                                <span className="text-xs font-bold opacity-70 mr-auto">(سعر الخدمة الأساسي)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-5 py-4 rounded-xl">
                                <Clock className="w-5 h-5 shrink-0" />
                                <span className="font-black text-base font-cairo">السعر يحدد بعد المعاينة</span>
                            </div>
                        )}
                    </div>

                </div>

                {/* ===== FOOTER (STICKY ACTIONS) ===== */}
                {!isArchived && (
                    <div className="px-8 py-5 border-t border-border/50 bg-muted/10 shrink-0 space-y-3">
                        {isPending && (
                            <div className="flex gap-3">
                                {booking.status === 'customer_rescheduled' ? (
                                    <button
                                        type="button"
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-13 rounded-xl font-black text-base font-cairo shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                                        onClick={() => {
                                            if (onAcceptAppointment) onAcceptAppointment(booking.id);
                                            onClose();
                                        }}
                                    >
                                        <Check className="w-5 h-5 ml-2" />
                                        الموافقة على الموعد المقترح
                                    </button>
                                ) : (
                                    booking.status !== 'provider_rescheduled' && (
                                        <button
                                            type="button"
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-13 rounded-xl font-black text-base font-cairo shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                                            onClick={() => { onAccept(booking); onClose(); }}
                                        >
                                            <Check className="w-5 h-5 ml-2" />
                                            {isMaintenance ? 'قبول وتأكيد الموعد' : (isManual ? 'بدء التحضير' : 'قبول الطلب')}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                        {/* Reschedule button removed - Direct acceptance only */}
                        {booking.status === 'provider_rescheduled' && (
                            <div className="w-full h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 font-bold font-cairo">
                                <Clock className="w-5 h-5 ml-2 animate-pulse" />
                                بانتظار رد العميل على الموعد
                            </div>
                        )}
                        {isConfirmed && (
                            <>
                                {showPhone && phone && (
                                    <a
                                        href={`tel:${phone}`}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-13 rounded-xl font-black text-base font-cairo shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Phone className="w-5 h-5" />
                                        اتصال بالعميل
                                    </a>
                                )}
                                <button
                                    type="button"
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white h-13 rounded-xl font-black text-base font-cairo shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                                    onClick={() => { onComplete(booking.id); onClose(); }}
                                >
                                    <Check className="w-5 h-5 ml-2" />
                                    {isMaintenance ? 'تم إتمام الخدمة ✓' : 'تم التجهيز ✓'}
                                </button>
                            </>
                        )}

                    </div>
                )}

            </div>
        </div>
    );
}
