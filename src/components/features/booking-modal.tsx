"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MapPin, Wrench, Utensils, ShoppingBag, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceProvider } from "./service-card";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";

interface BookingModalProps {
    provider: ServiceProvider;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export function BookingModal({ provider, open, onOpenChange }: BookingModalProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState<{ [key: string]: number }>({});
    const [selectedServiceType, setSelectedServiceType] = useState("");
    const [area, setArea] = useState("الحي الأول");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [newBookingId, setNewBookingId] = useState<string | null>(null);

    // Logic to determine if this is an "Order" (Restaurant) or "Booking" (Service)
    const isOrder = provider.category.includes("مطعم") || provider.category.includes("مطاعم") || provider.category.includes("بقالة") || provider.category.includes("صيدلية");

    // Use provider services if available, otherwise fallback to empty or mock
    const menuItems = provider.services && provider.services.length > 0 ? provider.services : [];

    // Close handler
    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep(1);
            setCart({});
            setSelectedServiceType("");
            setNotes("");
        }, 300);
    };

    // Steps Logic
    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const { createBooking, currentUser, addToGlobalCart } = useAppStore();

    const handleSubmit = async () => {
        // Instead of immediate booking, add to global cart
        if (isOrder) {
            Object.entries(cart).forEach(([id, qty]) => {
                const item = menuItems.find(i => String(i.id) === String(id));
                if (item) {
                    addToGlobalCart({
                        id: String(item.id),
                        name: item.name,
                        price: item.price,
                        quantity: qty,
                        providerId: String(provider.id),
                        providerName: provider.name,
                        image: item.image
                    });
                }
            });
            toast(`تم إضافة ${cartItemsCount} منتجات لسلة المشتريات`, "success");
        } else {
            const serviceName = selectedServiceType || "حجز خدمة";
            addToGlobalCart({
                id: `booking-${Date.now()}`,
                name: `${serviceName}`,
                price: 0,
                quantity: 1,
                providerId: provider.id,
                providerName: provider.name
            });
            toast(`تم إضافة "${serviceName}" لسلة المشتريات`, "success");
        }
        handleClose();
    };

    // Cart Logic
    const addToCart = (id: string) => setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    const removeFromCart = (id: string) => setCart(prev => {
        const newCart = { ...prev };
        if (newCart[id] > 1) newCart[id]--;
        else delete newCart[id];
        return newCart;
    });

    const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
        const item = menuItems.find(i => i.id === id);
        return total + (item ? item.price * qty : 0);
    }, 0);

    const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-bold text-lg">
                            {step === 4 ? "تم بنجاح" : isOrder ? `قائمة ${provider.name}` : `طلب خدمة من ${provider.name}`}
                        </h3>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" title="إغلاق" aria-label="إغلاق">
                            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-0 overflow-y-auto flex-1">
                        {step === 1 && (
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-6">
                                    {isOrder ? (
                                        <Utensils className="h-12 w-12 text-orange-500 mx-auto mb-2 bg-orange-100 dark:bg-orange-950/40 p-2 rounded-full" />
                                    ) : (
                                        <Wrench className="h-12 w-12 text-primary mx-auto mb-2 bg-primary/10 dark:bg-primary/20 p-2 rounded-full" />
                                    )}
                                    <h4 className="font-semibold text-lg">{isOrder ? "اطلب وجبتك المفضلة" : "ما هي المشكلة؟"}</h4>
                                    <p className="text-sm text-muted-foreground">{isOrder ? "أشهى الأطباق توصلك لحد عندك" : "حدد نوع الخدمة التي تحتاجها"}</p>
                                </div>

                                {isOrder ? (
                                    <div className="space-y-3">
                                        {menuItems.length > 0 ? (
                                            menuItems.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors">
                                                    <div>
                                                        <div className="font-bold">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground">{item.description}</div>
                                                        <div className="text-sm font-semibold text-orange-600 mt-1">{item.price} ج.م</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {cart[item.id] ? (
                                                            <>
                                                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => removeFromCart(item.id)}><Minus className="h-3 w-3" /></Button>
                                                                <span className="font-bold w-4 text-center">{cart[item.id]}</span>
                                                                <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600" onClick={() => addToCart(item.id)}><Plus className="h-3 w-3" /></Button>
                                                            </>
                                                        ) : (
                                                            <Button size="sm" variant="outline" onClick={() => addToCart(item.id)}>إضافة</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-slate-500">لا توجد خدمات متاحة حالياً</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {(menuItems.length > 0 ? menuItems.map(i => i.name) : ["صيانة عامة", "تركيب جديد", "فحص دوري", "طوارئ (فوري)"]).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setSelectedServiceType(type);
                                                    nextStep();
                                                }}
                                                className="w-full text-right p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all font-medium flex justify-between group"
                                            >
                                                {type}
                                                <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xl">←</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-6">
                                    <MapPin className="h-12 w-12 text-primary mx-auto mb-2 bg-primary/10 dark:bg-primary/20 p-2 rounded-full" />
                                    <h4 className="font-semibold text-lg">اين العنوان؟</h4>
                                    <p className="text-sm text-muted-foreground">سنقوم بإرسال {isOrder ? "الدليفري" : "الفني"} لهذا الموقع</p>
                                </div>

                                <div className="space-y-3">
                                    <label htmlFor="area-select" className="text-sm font-medium">المنطقة</label>
                                    <select
                                        id="area-select"
                                        aria-label="اختر المنطقة"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={area}
                                        onChange={(e) => setArea(e.target.value)}
                                    >
                                        <option>الحي الأول</option>
                                        <option>الحي الثاني</option>
                                        <option>ابني بيتك</option>
                                        <option>المنطقة الصناعية</option>
                                    </select>

                                    <label className="text-sm font-medium">العنوان بالتفصيل</label>
                                    <Input
                                        placeholder="اسم الشارع، رقم العمارة..."
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                    />

                                    <label className="text-sm font-medium">رقم الهاتف لتأكيد الطلب</label>
                                    <Input
                                        placeholder="01xxxxxxxxx"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="p-6 space-y-6">
                                <h4 className="font-bold text-center text-xl">ملخص الطلب</h4>

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">مقدم الخدمة:</span>
                                        <span className="font-semibold">{provider.name}</span>
                                    </div>

                                    {(address || phone) && (
                                        <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2 space-y-1">
                                            {address && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">العنوان:</span>
                                                    <span className="font-medium text-right">{area} - {address}</span>
                                                </div>
                                            )}
                                            {phone && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">الهاتف:</span>
                                                    <span className="font-medium">{phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isOrder ? (
                                        <>
                                            <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 space-y-2">
                                                {Object.entries(cart).map(([id, qty]) => {
                                                    const item = menuItems.find(i => i.id === id);
                                                    if (!item) return null;
                                                    return (
                                                        <div key={id} className="flex justify-between text-xs">
                                                            <span>{item.name} x{qty}</span>
                                                            <span>{item.price * qty} ج.م</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                                                <span className="font-bold">الإجمالي:</span>
                                                <span className="font-bold text-green-600 text-lg">{cartTotal} ج.م</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between border-t border-slate-200 mt-2 pt-2">
                                                <span className="text-muted-foreground">نوع الخدمة:</span>
                                                <span className="font-semibold">{selectedServiceType || "صيانة عامة"}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">رسوم المعاينة:</span>
                                                <span className="font-semibold text-green-600">50 ج.م</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="notes" className="text-sm font-medium">ملاحظات إضافية (اختياري)</label>
                                    <textarea
                                        id="notes"
                                        placeholder="أضف أي ملاحظات أو طلبات خاصة..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>

                                {!isOrder && (
                                    <p className="text-xs text-muted-foreground text-center bg-yellow-50 p-2 rounded text-yellow-800">
                                        ⚠️ السعر النهائي يحدده الفني بعد المعاينة، ورسوم المعاينة تخصم في حالة الإصلاح.
                                    </p>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="p-6 text-center py-8 space-y-4">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-green-700">تم إرسال طلبك!</h2>
                                <p className="text-muted-foreground text-lg">
                                    سيقوم {provider.name} {isOrder ? "بتجهيز طلبك فوراً" : "بالتواصل معك"} خلال دقائق.
                                </p>
                                <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 mt-6">
                                    رقم الطلب: #{newBookingId ? newBookingId.substring(0, 8) : 'PENDING'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {step < 4 && (
                        <div className="p-4 border-t bg-slate-50 flex gap-3">
                            {step > 1 && (
                                <Button variant="outline" onClick={prevStep} disabled={loading}>
                                    رجوع
                                </Button>
                            )}
                            <Button
                                className={isOrder ? "flex-1 bg-orange-500 hover:bg-orange-600" : "flex-1"}
                                onClick={step === 1 && !isOrder ? nextStep : handleSubmit}
                                disabled={
                                    loading ||
                                    (step === 1 && isOrder && cartItemsCount === 0)
                                }
                            >
                                {loading ? "جاري الإضافة..." : (isOrder || step === 2) ? "أضف للسلة" : "التالي"}
                            </Button>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="p-4 border-t bg-slate-50 space-y-2">
                            {newBookingId && (
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg" onClick={() => {
                                    handleClose();
                                    router.push(`/track/${newBookingId}`);
                                }}>
                                    تتبع الطلب الآن
                                </Button>
                            )}
                            <Button className="w-full" variant="outline" size="lg" onClick={handleClose}>
                                العودة للرئيسية
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
