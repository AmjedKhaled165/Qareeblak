"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MapPin, Wrench, Utensils, ShoppingBag, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceProvider } from "./service-card";
import { useAppStore } from "@/hooks/use-app-store";

interface BookingModalProps {
    provider: ServiceProvider;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export function BookingModal({ provider, open, onOpenChange }: BookingModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState<{ [key: string]: number }>({});
    const [selectedServiceType, setSelectedServiceType] = useState("");

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
        }, 300);
    };

    // Steps Logic
    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const { createBooking, currentUser } = useAppStore();

    const handleSubmit = () => {
        setLoading(true);

        // Prepare Booking Data
        let details = "";
        let serviceName = "";

        if (isOrder) {
            serviceName = "طلب طعام/منتجات";
            const items = Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find(i => i.id === id);
                return item ? `${item.name} x${qty}` : "";
            }).join(", ");
            details = `الطلبات: ${items} | الإجمالي: ${cartTotal} ج.م`;
        } else {
            serviceName = selectedServiceType || "حجز خدمة صيانة";
            // We need to capture the selected service type from step 1
            details = `${selectedServiceType || "صيانة عامة"} (معاينة)`;
        }

        setTimeout(() => {
            createBooking({
                userName: currentUser ? currentUser.name : "زائر",
                userId: currentUser?.id,
                providerId: provider.id,
                providerName: provider.name,
                serviceName: serviceName,
                price: isOrder ? cartTotal : undefined,
                serviceId: undefined, // For general booking/multi-order
                details: details
            });
            setLoading(false);
            nextStep();
        }, 1000);
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
                    className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                        <h3 className="font-bold text-lg">
                            {step === 4 ? "تم بنجاح" : isOrder ? `قائمة ${provider.name}` : `طلب خدمة من ${provider.name}`}
                        </h3>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="h-5 w-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-0 overflow-y-auto flex-1">
                        {step === 1 && (
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-6">
                                    {isOrder ? (
                                        <Utensils className="h-12 w-12 text-orange-500 mx-auto mb-2 bg-orange-100 p-2 rounded-full" />
                                    ) : (
                                        <Wrench className="h-12 w-12 text-primary mx-auto mb-2 bg-primary/10 p-2 rounded-full" />
                                    )}
                                    <h4 className="font-semibold text-lg">{isOrder ? "اطلب وجبتك المفضلة" : "ما هي المشكلة؟"}</h4>
                                    <p className="text-sm text-muted-foreground">{isOrder ? "أشهى الأطباق توصلك لحد عندك" : "حدد نوع الخدمة التي تحتاجها"}</p>
                                </div>

                                {isOrder ? (
                                    <div className="space-y-3">
                                        {menuItems.length > 0 ? (
                                            menuItems.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-orange-200 hover:bg-orange-50 transition-colors">
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
                                                    // Store selected service type for submission (we might need a state for this)
                                                    // For now, nextStep is what was there. We should ideally pass this 'type' to the next step or state.
                                                    // But to keep it simple and consistent with previous logic:
                                                    nextStep();
                                                }}
                                                className="w-full text-right p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all font-medium flex justify-between group"
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
                                    <MapPin className="h-12 w-12 text-primary mx-auto mb-2 bg-primary/10 p-2 rounded-full" />
                                    <h4 className="font-semibold text-lg">اين العنوان؟</h4>
                                    <p className="text-sm text-muted-foreground">سنقوم بإرسال {isOrder ? "الدليفري" : "الفني"} لهذا الموقع</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-medium">المنطقة</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option>الحي الأول</option>
                                        <option>الحي الثاني</option>
                                        <option>ابني بيتك</option>
                                        <option>المنطقة الصناعية</option>
                                    </select>

                                    <label className="text-sm font-medium">العنوان بالتفصيل</label>
                                    <Input placeholder="اسم الشارع، رقم العمارة..." />

                                    <label className="text-sm font-medium">رقم الهاتف لتأكيد الطلب</label>
                                    <Input placeholder="01xxxxxxxxx" type="tel" />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="p-6 space-y-6">
                                <h4 className="font-bold text-center text-xl">ملخص الطلب</h4>

                                <div className="bg-slate-50 p-4 rounded-lg space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">مقدم الخدمة:</span>
                                        <span className="font-semibold">{provider.name}</span>
                                    </div>

                                    {isOrder ? (
                                        <>
                                            <div className="border-t my-2 pt-2 space-y-2">
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
                                            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                                                <span className="font-bold">الإجمالي:</span>
                                                <span className="font-bold text-green-600 text-lg">{cartTotal} ج.م</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">نوع الخدمة:</span>
                                                <span className="font-semibold">صيانة عامة</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">رسوم المعاينة:</span>
                                                <span className="font-semibold text-green-600">50 ج.م</span>
                                            </div>
                                        </>
                                    )}
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
                                    رقم الطلب: #ORD-{Math.floor(Math.random() * 10000)}
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
                                onClick={step === 1 && isOrder ? nextStep : step === 3 ? handleSubmit : nextStep}
                                disabled={loading || (step === 1 && isOrder && cartItemsCount === 0)}
                            >
                                {loading ? "جاري الإرسال..." : step === 3 ? (isOrder ? `تأكيد (${cartTotal} ج.م)` : "تأكيد الطلب") : "التالي"}
                            </Button>
                        </div>
                    )}
                    {step === 4 && (
                        <div className="p-4 border-t bg-slate-50">
                            <Button className="w-full" size="lg" onClick={handleClose}>
                                العودة للرئيسية
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
