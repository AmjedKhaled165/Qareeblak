"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Send, User, MapPin, Phone, FileText, Loader2, Package, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ProviderSearchDropdown } from "@/components/shared/provider-search-dropdown";
import { apiCall } from "@/lib/api";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function EditOrderPage({ params }: PageProps) {
    const router = useRouter();
    const resolvedParams = use(params);
    const orderId = resolvedParams.id;

    const [drivers, setDrivers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: 'success' | 'error', title: string, message: string }>({
        type: 'success',
        title: '',
        message: ''
    });

    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        courierId: '',
        notes: '',
        deliveryFee: '',
        products: [{ name: '', quantity: 1, price: 0, note: '', providerId: '', providerName: '' }]
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }

        // Fetch data
        fetchDrivers();
        fetchOrderDetails();
    }, []);

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

    const fetchOrderDetails = async () => {
        try {
            const data = await apiCall(`/halan/orders/${orderId}`);

            if (data.success && data.data) {
                const order = data.data;
                // Parse items if string, or use directly if array
                let items = [];
                if (typeof order.items === 'string') {
                    try { items = JSON.parse(order.items); } catch (e) { items = []; }
                } else {
                    items = order.items || [];
                }

                if (items.length === 0) items = [{ name: '', quantity: 1, price: 0, note: '', providerId: '', providerName: '' }];

                setFormData({
                    customerName: order.customer_name || '',
                    customerPhone: order.customer_phone || '',
                    deliveryAddress: order.delivery_address || '',
                    courierId: order.courier_id ? order.courier_id.toString() : '',
                    notes: order.notes || '',
                    deliveryFee: order.delivery_fee ? order.delivery_fee.toString() : '',
                    products: items
                });
            } else {
                showMessage('error', 'خطأ', data.error || 'لم يتم العثور على الطلب');
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            showMessage('error', 'خطأ', 'حدث خطأ أثناء تحميل بيانات الطلب');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = () => {
        setFormData({
            ...formData,
            products: [...formData.products, { name: '', quantity: 1, price: 0, note: '', providerId: '', providerName: '' }]
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
    };

    const handleProviderChange = (index: number, providerId: string, providerName: string) => {
        const newProducts = [...formData.products];
        newProducts[index] = { ...newProducts[index], providerId, providerName };
        setFormData({ ...formData, products: newProducts });
    };

    const showMessage = (type: 'success' | 'error', title: string, message: string) => {
        setModalConfig({ type, title, message });
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        if (modalConfig.type === 'success') {
            router.push('/partner/orders');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.customerName || !formData.customerPhone || !formData.deliveryAddress) {
            showMessage('error', 'بيانات ناقصة', 'يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        // Ensure at least one product has a name
        const validProducts = formData.products.filter(p => p.name.trim() !== '');
        if (validProducts.length === 0) {
            showMessage('error', 'تنبيه', 'يجب إضافة منتج واحد على الأقل');
            return;
        }

        setIsSaving(true);
        try {
            const data = await apiCall(`/halan/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    customerName: formData.customerName,
                    customerPhone: formData.customerPhone,
                    deliveryAddress: formData.deliveryAddress,
                    notes: formData.notes,
                    courierId: formData.courierId || null,
                    deliveryFee: parseFloat(formData.deliveryFee) || 0,
                    items: validProducts.map(p => ({
                        name: p.name,
                        quantity: Number(p.quantity),
                        price: Number(p.price) || 0,
                        note: p.note,
                        providerId: p.providerId,
                        providerName: p.providerName
                    }))
                })
            });

            if (data.success) {
                showMessage('success', 'نجاح', 'تم تعديل الطلب بنجاح');
            } else {
                showMessage('error', 'فشل', data.error || 'فشل تعديل الطلب');
            }
        } catch (error) {
            console.error('Error updating order:', error);
            showMessage('error', 'خطأ', 'حدث خطأ أثناء تعديل الطلب');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950" dir="rtl">
            <Dialog open={showModal} onOpenChange={handleModalClose}>
                <DialogContent className="sm:max-w-md text-center" dir="rtl">
                    <DialogHeader>
                        <div className="flex justify-center mb-4">
                            {modalConfig.type === 'success' ? (
                                <div className="p-3 bg-green-100 rounded-full">
                                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                                </div>
                            ) : (
                                <div className="p-3 bg-red-100 rounded-full">
                                    <AlertCircle className="w-12 h-12 text-red-600" />
                                </div>
                            )}
                        </div>
                        <DialogTitle className="text-xl font-bold text-center">
                            {modalConfig.title}
                        </DialogTitle>
                        <DialogDescription className="text-center text-lg mt-2 font-medium text-slate-600 dark:text-slate-300">
                            {modalConfig.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center mt-4">
                        <button
                            onClick={handleModalClose}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${modalConfig.type === 'success'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {modalConfig.type === 'success' ? 'حسناً، العودة للطلبات' : 'إغلاق'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Header */}
            <div
                className="p-6 pt-10 rounded-b-[30px] shadow-lg"
                style={{
                    background: 'linear-gradient(135deg, #FF9F0A 0%, #FFB340 100%)'
                }}
            >
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2">
                        <ArrowRight className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-2xl font-bold text-white">تعديل الطلب</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">

                {/* Driver Selection */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm transition-colors">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                        <User className="w-5 h-5 text-indigo-500" />
                        تحديد المندوب
                    </h3>
                    <select
                        value={formData.courierId}
                        onChange={(e) => setFormData({ ...formData, courierId: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    >
                        <option value="">-- اختر المندوب (اختياري) --</option>
                        {drivers.map(driver => (
                            <option key={driver.id} value={driver.id}>
                                {driver.name || driver.username} ({driver.phone})
                            </option>
                        ))}
                    </select>
                </div>

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
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                            placeholder="أدخل اسم العميل"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف</label>
                        <input
                            type="tel"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">العنوان</label>
                        <textarea
                            value={formData.deliveryAddress}
                            onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[80px]"
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
                        <button type="button" onClick={handleAddProduct} className="text-amber-600 hover:bg-amber-50 p-2 rounded-full transition-colors">
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
                            📝 أدخل اسم المنتج والكمية.
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
                                    <input
                                        type="text"
                                        value={product.name}
                                        onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                                        placeholder="اسم المنتج (مثال: لبن، طماطم، عيش)"
                                    />

                                    {/* Provider Dropdown */}
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">🏪 مقدم الخدمة (لتغيير المسار)</label>
                                        <ProviderSearchDropdown
                                            value={product.providerId || ''}
                                            providerName={product.providerName || ''}
                                            onChange={(providerId, providerName) => handleProviderChange(index, providerId, providerName)}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="w-24">
                                            <label className="text-xs text-slate-500 block mb-1">📦 الكمية</label>
                                            <input
                                                type="number"
                                                value={product.quantity}
                                                onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                                                className="w-full px-2 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold text-lg text-slate-900 dark:text-white"
                                                placeholder="1"
                                                min="1"
                                            />
                                        </div>
                                        <div className="w-28">
                                            <label className="text-xs text-slate-500 block mb-1">💰 السعر (ج.م)</label>
                                            <input
                                                type="number"
                                                value={product.price}
                                                onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                                                className="w-full px-2 py-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-center font-bold text-lg text-slate-900 dark:text-white"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">📝 ملاحظات (اختياري)</label>
                                            <input
                                                type="text"
                                                value={product.note}
                                                onChange={(e) => handleProductChange(index, 'note', e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                                                placeholder="مثال: كبير..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery Fee */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm transition-colors">
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2 font-bold">سعر التوصيل</label>
                    <div className="flex items-center justify-center gap-4">
                        <input
                            type="number"
                            value={formData.deliveryFee}
                            onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                            className="w-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-center text-lg font-bold text-slate-900 dark:text-white"
                            placeholder="0"
                            dir="ltr"
                        />
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-300">جنيه</span>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-[#FF9F0A] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#E68A00] transition-all disabled:opacity-70 shadow-md shadow-amber-200 dark:shadow-none"
                >
                    {isSaving ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            حفظ التعديلات
                        </>
                    )}
                </button>

                <div className="h-10"></div>
            </form>
        </div>
    );
}
