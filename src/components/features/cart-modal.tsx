"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { X, ShoppingCart, Trash2, Plus, Minus, Loader2, ArrowLeft, Package, MapPin, Phone, CheckCircle2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { wheelApi } from "@/lib/api";

interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CartModal({ isOpen, onClose }: CartModalProps) {
    const { globalCart, removeFromGlobalCart, updateGlobalCartQuantity, checkoutGlobalCart, isLoading, currentUser } = useAppStore();
    const { toast } = useToast();
    const router = useRouter();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [step, setStep] = useState(1); // 1: review, 2: address
    const [prizes, setPrizes] = useState<any[]>([]);
    const [selectedPrize, setSelectedPrize] = useState<any>(null);
    const [addressForm, setAddressForm] = useState({
        area: "الحي الأول",
        details: "",
        phone: ""
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen && currentUser) {
            loadPrizes();
        }
    }, [isOpen, currentUser]);

    const loadPrizes = async () => {
        try {
            const data = await wheelApi.getMyPrizes();
            if (data && data.length > 0) setPrizes(data);
        } catch (e) {
            console.error("Failed to load prizes", e);
        }
    };

    const totalAmount = globalCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartProviderIds = new Set(globalCart.map(item => String(item.providerId)));

    const applicablePrizes = prizes.filter(prize => {
        if (!prize.provider_id) return true; // Global prize
        return cartProviderIds.has(String(prize.provider_id));
    });

    // Auto-remove selected prize if it's no longer applicable
    useEffect(() => {
        if (selectedPrize && selectedPrize.provider_id && !cartProviderIds.has(String(selectedPrize.provider_id))) {
            setSelectedPrize(null);
        }
    }, [globalCart, selectedPrize]);

    // Calculate applied discount nicely for UI
    let displayDiscount = 0;
    if (selectedPrize) {
        const isStillApplicable = !selectedPrize.provider_id || cartProviderIds.has(String(selectedPrize.provider_id));

        if (isStillApplicable) {
            const baseForDiscount = selectedPrize.provider_id
                ? globalCart.filter(i => String(i.providerId) === String(selectedPrize.provider_id)).reduce((s, i) => s + (i.price * i.quantity), 0)
                : totalAmount;

            if (selectedPrize.prize_type === 'discount_percent') {
                displayDiscount = baseForDiscount * (selectedPrize.prize_value / 100);
            } else if (selectedPrize.prize_type === 'discount_flat') {
                displayDiscount = Math.min(baseForDiscount, selectedPrize.prize_value);
            } else if (selectedPrize.prize_type === 'free_delivery') {
                displayDiscount = 0; // Handled differently
            }
        }
    }
    const finalAmountAfterDiscount = Math.max(0, totalAmount - displayDiscount);

    const handleCheckout = async () => {
        if (!currentUser) {
            toast("يرجى تسجيل الدخول أولاً لإتمام الطلب", "error");
            router.push("/login/user");
            onClose();
            return;
        }

        if (!addressForm.details || !addressForm.phone) {
            toast("يرجى إكمال بيانات العنوان والهاتف", "error");
            return;
        }

        setIsCheckingOut(true);
        const result = await checkoutGlobalCart(addressForm, selectedPrize?.user_prize_id);
        setIsCheckingOut(false);

        if (result) {
            toast("تم إرسال طلباتك بنجاح لمقدمي الخدمة!", "success");
            onClose();

            if (Array.isArray(result) && result.length === 1) {
                router.push(`/track/${result[0]}`);
            } else {
                router.push("/track");
            }
        } else {
            toast("حدث خطأ أثناء إتمام الطلب، يرجى المحاولة مرة أخرى", "error");
        }
    };

    const handleClose = () => {
        setStep(1);
        setSelectedPrize(null);
        onClose();
    };

    // Group items by provider for display
    const groupedItems: Record<string, { providerName: string, items: any[] }> = {};
    globalCart.forEach(item => {
        const pId = String(item.providerId || "unknown");
        if (!groupedItems[pId]) {
            groupedItems[pId] = {
                providerName: item.providerName || "مزود خدمة غير معروف",
                items: []
            };
        }
        groupedItems[pId].items.push(item);
    });

    const handleContinueToShipping = () => {
        setStep(2);
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9998]"
                        style={{ position: 'fixed', inset: 0 }}
                    />

                    {/* Modal Content - Forced Bottom with Inline Styles */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                            mass: 0.8
                        }}
                        style={{
                            position: 'fixed',
                            bottom: 0,
                            top: 'auto', // Explicitly reset top
                            left: 0,
                            right: 0,
                            margin: '0 auto',
                            zIndex: 9999,
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] overflow-hidden border-t border-slate-100 dark:border-slate-800"
                    >
                        {/* Drag Handle Decoration */}
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-5 shrink-0" />

                        {/* Header Area */}
                        <div className="px-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                    <ShoppingCart className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">سلة المشتريات</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">لديك {globalCart.length} منتجات في السلة</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div
                            className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {globalCart.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <ShoppingCart className="w-10 h-10" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">السلة فارغة</h4>
                                    <p className="text-slate-500 text-sm mb-6">لم تقم بإضافة أي منتجات للسلة بعد.</p>
                                    <Button onClick={handleClose} className="rounded-xl px-8">تصفح الخدمات</Button>
                                </div>
                            ) : step === 1 ? (
                                Object.entries(groupedItems).map(([providerId, data]) => (
                                    <div key={providerId} className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400 px-1 uppercase tracking-wider">
                                            <Package className="w-4 h-4" />
                                            {data.providerName}
                                        </div>
                                        <div className="space-y-3">
                                            {data.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group"
                                                >
                                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                <Package className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{item.name}</h4>
                                                        <p className="text-primary font-bold">{item.price} ج.م</p>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                                                            <button
                                                                onClick={() => updateGlobalCartQuantity(providerId, item.id, item.quantity - 1)}
                                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                                                            >
                                                                <Minus className="w-4 h-4" />
                                                            </button>
                                                            <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateGlobalCartQuantity(providerId, item.id, item.quantity + 1)}
                                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFromGlobalCart(providerId, item.id)}
                                                            className="text-red-500 hover:text-red-600 transition-colors p-1"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                                            <MapPin className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-lg font-bold">أين تريد استلام الطلبات؟</h4>
                                        <p className="text-sm text-slate-500">يرجى تحديد موقعك بدقة لضمان سرعة التوصيل</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400">المنطقة</label>
                                            <select
                                                className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary outline-none"
                                                value={addressForm.area}
                                                onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })}
                                            >
                                                <option>الحي الأول</option>
                                                <option>الحي الثاني</option>
                                                <option>الحي الثالث</option>
                                                <option>الحي الرابع</option>
                                                <option>الحي الخامس</option>
                                                <option>ابني بيتك</option>
                                                <option>المنطقة الصناعية</option>
                                                <option>منطقة الجامعات</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400">العنوان بالتفصيل</label>
                                            <Input
                                                placeholder="اسم الشارع، رقم العمارة، رقم الشقة..."
                                                className="h-12 rounded-xl border-slate-200 dark:border-slate-700"
                                                value={addressForm.details}
                                                onChange={(e) => setAddressForm({ ...addressForm, details: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400">رقم الهاتف للتواصل</label>
                                            <div className="relative">
                                                <Phone className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                                <Input
                                                    placeholder="01xxxxxxxxx"
                                                    className="h-12 rounded-xl border-slate-200 dark:border-slate-700 pl-12"
                                                    value={addressForm.phone}
                                                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Display Available Prizes */}
                                    {applicablePrizes.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            <label className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                                <Gift className="w-4 h-4" />
                                                لديك جوائز متوافقة مع طلبك!
                                            </label>
                                            <div className="grid gap-2 max-h-40 overflow-y-auto">
                                                {applicablePrizes.map((prize, idx) => {
                                                    const isSelected = selectedPrize?.user_prize_id === prize.user_prize_id;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setSelectedPrize(isSelected ? null : prize)}
                                                            className={`text-right w-full flex items-center justify-between p-3 rounded-xl border ${isSelected ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} transition-all`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                                                                    style={{ backgroundColor: prize.color || '#f44336' }}
                                                                >
                                                                    <Gift className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <p className={`font-bold text-sm ${isSelected ? 'text-orange-700 dark:text-orange-400' : ''}`}>{prize.name}</p>
                                                                    {prize.provider_id && <p className="text-[10px] text-slate-500">خاص بمتجر محدد</p>}
                                                                </div>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                </motion.div>
                            )}
                        </div>

                        {/* Footer */}
                        {globalCart.length > 0 && (
                            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black/20 shrink-0">
                                {selectedPrize && (
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-orange-500 font-medium text-sm flex items-center gap-1">
                                            <Gift className="w-4 h-4" /> خصم الجائزة
                                        </span>
                                        <span className="text-orange-500 font-bold text-sm">
                                            {selectedPrize.prize_type === 'free_delivery' ? 'توصيل مجاني' : `- ${displayDiscount.toFixed(2)} ج.م`}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-slate-500 font-medium">الإجمالي النهائي</span>
                                    <span className="text-2xl font-black text-primary">{finalAmountAfterDiscount.toFixed(2)} ج.م</span>
                                </div>

                                <div className="flex gap-3">
                                    {step === 1 ? (
                                        <Button
                                            onClick={handleContinueToShipping}
                                            className="w-full rounded-2xl py-6 bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-lg shadow-primary/20"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>استمرار للشحن</span>
                                                <ArrowLeft className="w-5 h-5" />
                                            </div>
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => setStep(1)}
                                                className="flex-1 rounded-2xl py-6 border-slate-200 dark:border-slate-700"
                                            >
                                                رجوع للمراجعة
                                            </Button>
                                            <Button
                                                onClick={handleCheckout}
                                                disabled={isCheckingOut || isLoading}
                                                className="flex-[2] rounded-2xl py-6 bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-lg shadow-green-600/20"
                                            >
                                                {isCheckingOut ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        جاري الإرسال...
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span>تأكيد الطلب</span>
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )
            }
        </AnimatePresence>,
        document.body
    );
}
