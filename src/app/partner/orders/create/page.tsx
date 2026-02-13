"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Send, User, MapPin, Phone, FileText, Loader2, Package, Plus, Trash2, Search, Store, X } from "lucide-react";
import StatusModal from "@/components/ui/status-modal";
import { apiCall } from "@/lib/api";

interface Provider {
    id: string;
    name: string;
    category?: string;
}

import { ProviderSearchDropdown } from "@/components/shared/provider-search-dropdown";

// ═══════════════════════════════════════
// Main Create Order Page
// ═══════════════════════════════════════
export default function CreateOrderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedDriverId = searchParams.get('driverId');
    const preselectedDriverName = searchParams.get('driverName');

    interface Product {
        id: string;
        name: string;
        price?: number;
    }

    const [drivers, setDrivers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCourier, setIsCourier] = useState(false);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [focusedProductIndex, setFocusedProductIndex] = useState<number | null>(null);

    // Status Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onCloseAction?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
    });

    const [formData, setFormData] = useState<{
        customerName: string;
        customerPhone: string;
        deliveryAddress: string;
        courierId: string;
        notes: string;
        deliveryFee: string;
        products: { name: string; quantity: number; price: number; note?: string; providerId?: string; providerName?: string }[];
    }>({
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        courierId: preselectedDriverId || '',
        notes: '',
        deliveryFee: '',
        products: [{ name: '', quantity: 1, price: 0 }]
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        const user = JSON.parse(storedUser);
        if (user.role === 'courier' || user.role === 'partner_courier') {
            setIsCourier(true);
            setFormData(prev => ({ ...prev, courierId: user.id.toString() }));
        } else {
            fetchDrivers();
        }
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const data = await apiCall('/halan/products');
            if (data.success) {
                setAllProducts(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchDrivers = async () => {
        try {
            const data = await apiCall('/halan/users?role=courier');
            if (data.success) {
                setDrivers(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    const handleAddProduct = () => {
        setFormData({
            ...formData,
            products: [...formData.products, { name: '', quantity: 1, price: 0 }]
        });
    };

    const handleRemoveProduct = (index: number) => {
        if (formData.products.length === 1) return;
        const newProducts = [...formData.products];
        newProducts.splice(index, 1);
        setFormData({ ...formData, products: newProducts });
    };

    const handleProductChange = (index: number, field: 'name' | 'quantity' | 'price' | 'note', value: any) => {
        const newProducts = [...formData.products];
        newProducts[index] = { ...newProducts[index], [field]: value };
        setFormData({ ...formData, products: newProducts });

        if (field === 'name') {
            if (value.trim()) {
                const filtered = allProducts.filter(p =>
                    p.name.toLowerCase().includes(value.toLowerCase())
                );
                setSuggestions(filtered);
                setFocusedProductIndex(index);
            } else {
                setSuggestions([]);
            }
        }
    };

    const handleSelectProduct = (index: number, name: string) => {
        const newProducts = [...formData.products];
        newProducts[index] = { ...newProducts[index], name };
        setFormData({ ...formData, products: newProducts });
        setSuggestions([]);
        setFocusedProductIndex(null);
    };

    const handleProviderChange = (index: number, providerId: string, providerName: string) => {
        const newProducts = [...formData.products];
        newProducts[index] = { ...newProducts[index], providerId, providerName };
        setFormData({ ...formData, products: newProducts });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.courierId) {
            setModalState({
                isOpen: true,
                title: 'تنبيه',
                message: 'يرجى اختيار المندوب أولاً',
                type: 'warning'
            });
            return;
        }

        if (!formData.customerName || !formData.customerPhone || !formData.deliveryAddress) {
            setModalState({
                isOpen: true,
                title: 'بيانات ناقصة',
                message: 'يرجى ملء جميع الحقول المطلوبة (الاسم، الهاتف، العنوان)',
                type: 'warning'
            });
            return;
        }

        // Ensure at least one product has a name
        const validProducts = formData.products.filter(p => p.name.trim() !== '');
        if (validProducts.length === 0) {
            setModalState({
                isOpen: true,
                title: 'تنبيه',
                message: 'يجب إضافة منتج واحد على الأقل',
                type: 'warning'
            });
            return;
        }

        setIsLoading(true);
        try {
            const data = await apiCall('/halan/orders', {
                method: 'POST',
                body: JSON.stringify({
                    customerName: formData.customerName,
                    customerPhone: formData.customerPhone,
                    pickupAddress: 'المحل / المخزن',
                    deliveryAddress: formData.deliveryAddress,
                    courierId: formData.courierId || null,
                    notes: formData.notes,
                    deliveryFee: parseFloat(formData.deliveryFee) || 0,
                    products: validProducts
                })
            });

            if (data.success) {
                const splitMsg = data.splitMode
                    ? `تم تقسيم الطلب إلى ${data.bookingIds?.length || 0} طلبات فرعية حسب مقدمي الخدمة.`
                    : 'تم إنشاء الطلب وإرساله للمندوب بنجاح.';

                setModalState({
                    isOpen: true,
                    title: 'تم بنجاح! 🎉',
                    message: splitMsg,
                    type: 'success',
                    onCloseAction: () => router.push('/partner/orders')
                });
            } else {
                setModalState({
                    isOpen: true,
                    title: 'فشل الإنشاء',
                    message: data.error || 'فشل إنشاء الطلب',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Error creating order:', error);

            // Check if it's a timeout error
            const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
            const isTimeout = errorMessage.includes('انتهت مهلة الطلب') || errorMessage.includes('timeout');

            setModalState({
                isOpen: true,
                title: isTimeout ? 'تحذير ⏱️' : 'خطأ',
                message: isTimeout
                    ? 'استغرق الطلب وقتاً أطول من المتوقع. قد يكون قد تم إنشاؤه بنجاح. يرجى التحقق من سجل الطلبات.'
                    : errorMessage || 'حدث خطأ غير متوقع أثناء إنشاء الطلب',
                type: isTimeout ? 'warning' : 'error',
                onCloseAction: isTimeout ? () => router.push('/partner/orders') : undefined
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950" dir="rtl">
            {/* Header */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg bg-gradient-to-br from-[#504DFF] to-[#624AF2]"
            >
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2" title="العودة" aria-label="العودة للصفحة السابقة">
                        <ArrowRight className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-2xl font-bold text-white">إنشاء طلب جديد</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Driver Selection - HIDDEN for couriers */}
                {!isCourier && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm space-y-3 border-2 border-indigo-100 dark:border-indigo-900/30 transition-colors">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-500" />
                            اختيار المندوب
                        </h3>
                        <div>
                            <select
                                value={formData.courierId}
                                onChange={(e) => setFormData({ ...formData, courierId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white appearance-none font-bold"
                                required
                                title="اختر المندوب"
                                aria-label="قائمة المناديب"
                            >
                                <option value="">-- اختر المندوب --</option>
                                {drivers.map(driver => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.name} (@{driver.username})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2">يجب اختيار المندوب الذي سيقوم بتوصيل الطلب.</p>
                        </div>
                    </div>
                )}

                {/* Driver Badge (if pre-selected via URL) */}
                {preselectedDriverName && !formData.courierId && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full">
                            <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">المندوب المختار</p>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{preselectedDriverName}</p>
                        </div>
                    </div>
                )}

                {/* Customer Info */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        بيانات العميل
                    </h3>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">اسم العميل</label>
                        <input
                            type="text"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                            placeholder="أدخل اسم العميل"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف</label>
                        <input
                            type="tel"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">العنوان</label>
                        <textarea
                            value={formData.deliveryAddress}
                            onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[80px]"
                            placeholder="أدخل العنوان بالتفصيل"
                        />
                    </div>
                </div>

                {/* Products List */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            🛒 قائمة المشتريات
                        </h3>
                        <button type="button" onClick={handleAddProduct} className="text-violet-600 hover:bg-violet-50 p-2 rounded-full transition-colors" title="إضافة منتج">
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Hint Box */}
                    <div className="bg-blue-50 dark:bg-slate-800/50 p-3 rounded-lg flex gap-3 items-center">
                        <div className="shrink-0">
                            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            📝 أدخل اسم المنتج والكمية. يمكنك تحديد مقدم الخدمة لكل منتج لتقسيم الطلب تلقائياً.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {formData.products.map((product, index) => (
                            <div key={index} className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 relative">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-slate-500 text-sm">منتج {index + 1}</span>
                                    {formData.products.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(index)}
                                            className="text-red-500 hover:bg-red-50 p-1 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={product.name}
                                            onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                                            onFocus={() => {
                                                if (product.name.trim()) {
                                                    const filtered = allProducts.filter(p =>
                                                        p.name.toLowerCase().includes(product.name.toLowerCase())
                                                    );
                                                    setSuggestions(filtered);
                                                    setFocusedProductIndex(index);
                                                }
                                            }}
                                            onBlur={() => {
                                                // Small delay to allow clicking a suggestion
                                                setTimeout(() => {
                                                    setSuggestions([]);
                                                    setFocusedProductIndex(null);
                                                }, 200);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                                            placeholder="اسم المنتج (مثال: لبن، طماطم، عيش)"
                                            title="اسم المنتج"
                                            aria-label="اسم المنتج"
                                        />

                                        {/* Suggestions Dropdown */}
                                        {focusedProductIndex === index && suggestions.length > 0 && (
                                            <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[100] max-h-48 overflow-auto">
                                                {suggestions.map((s, sIdx) => (
                                                    <div
                                                        key={s.id}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevent input blur
                                                            handleSelectProduct(index, s.name);
                                                        }}
                                                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 font-medium text-slate-700 dark:text-slate-200"
                                                    >
                                                        {s.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Provider Dropdown */}
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">🏪 مقدم الخدمة (اختياري)</label>
                                        <ProviderSearchDropdown
                                            value={product.providerId || ''}
                                            providerName={product.providerName || ''}
                                            onChange={(providerId, providerName) => handleProviderChange(index, providerId, providerName)}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-20">
                                            <label className="text-xs text-slate-500 block mb-1">📦 الكمية</label>
                                            <input
                                                type="number"
                                                value={product.quantity}
                                                onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                                                className="w-full px-2 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold text-lg text-slate-900 dark:text-white"
                                                placeholder="1"
                                                min="1"
                                                title="الكمية"
                                                aria-label="كمية المنتج"
                                            />
                                        </div>
                                        <div className="w-28">
                                            <label className="text-xs text-slate-500 block mb-1">💰 السعر</label>
                                            <input
                                                type="number"
                                                value={product.price}
                                                onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                                                className="w-full px-2 py-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-center font-bold text-lg text-slate-900 dark:text-white"
                                                placeholder="0"
                                                min="0"
                                                title="السعر"
                                                aria-label="سعر المنتج"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">📝 ملاحظات (اختياري)</label>
                                            <input
                                                type="text"
                                                value={product.note || ''}
                                                onChange={(e) => handleProductChange(index, 'note', e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                                                placeholder="مثال: كبير..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Split Order Indicator */}
                    {formData.products.some(p => p.providerId) && (
                        <div className="bg-violet-50 dark:bg-violet-900/20 p-3 rounded-lg flex gap-3 items-center border border-violet-200 dark:border-violet-800">
                            <Store className="w-5 h-5 text-violet-500 shrink-0" />
                            <p className="text-sm text-violet-700 dark:text-violet-300">
                                🔀 سيتم تقسيم الطلب تلقائياً إلى طلبات فرعية حسب مقدمي الخدمة المحددين.
                            </p>
                        </div>
                    )}
                </div>

                {/* Delivery Fee */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm transition-colors">
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2 font-bold">سعر التوصيل</label>
                    <div className="flex items-center justify-center gap-4">
                        <input
                            type="number"
                            value={formData.deliveryFee}
                            onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                            className="w-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-center text-lg font-bold text-slate-900 dark:text-white"
                            placeholder="0"
                            dir="ltr"
                        />
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-300">جنيه</span>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#504DFF] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#403ecf] transition-all disabled:opacity-70 shadow-md shadow-indigo-200 dark:shadow-none"
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <Send className="w-5 h-5 rotate-180" />
                            {isCourier ? 'بدء التوصيل فوراً' : 'إرسال الطلب للمندوب'}
                        </>
                    )}
                </button>

                <div className="h-10"></div>
            </form>

            <StatusModal
                isOpen={modalState.isOpen}
                onClose={() => {
                    setModalState(prev => ({ ...prev, isOpen: false }));
                    if (modalState.onCloseAction) {
                        modalState.onCloseAction();
                    }
                }}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />
        </div>
    );
}
