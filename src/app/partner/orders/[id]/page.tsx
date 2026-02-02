"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowRight,
    MapPin,
    Phone,
    MessageCircle,
    Navigation,
    CheckCircle,
    Package,
    Clock,
    Loader2,
    Edit3,
    AlertTriangle,
    Save,
    Plus,
    Minus,
    Trash2
} from "lucide-react";
import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";

interface OrderItem {
    name: string;
    product_name?: string;
    quantity: number;
    price: number;
    unit_price?: number;
    notes?: string;
}

interface Order {
    id: number;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
    created_at: string;
    notes?: string;
    delivery_fee?: number;
    items?: OrderItem[];
    is_modified_by_courier?: boolean;
    courier_modifications?: any;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function OrderDetailsPage({ params }: PageProps) {
    const router = useRouter();
    const [orderId, setOrderId] = useState<string>('');
    const [order, setOrder] = useState<Order | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [focusedProductIndex, setFocusedProductIndex] = useState<number | null>(null);

    // Editable state (inline editing)
    const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
    const [editableDeliveryFee, setEditableDeliveryFee] = useState<number>(0);
    const [editableNotes, setEditableNotes] = useState<string>('');
    const [hasChanges, setHasChanges] = useState(false);

    // Status Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'success'
    });

    useEffect(() => {
        params.then((p) => setOrderId(p.id));
    }, [params]);

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser) {
            router.push('/login/partner');
            return;
        }
        setUser(JSON.parse(storedUser));
    }, []);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
            fetchProducts();
        }
    }, [orderId]);

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

    const fetchOrder = async () => {
        try {
            const data = await apiCall(`/halan/orders/${orderId}`);

            if (data.success) {
                const found = data.data;
                if (found) {
                    // Parse items if string
                    if (typeof found.items === 'string') {
                        try {
                            found.items = JSON.parse(found.items);
                        } catch { found.items = []; }
                    }
                    setOrder(found);

                    // Initialize editable fields
                    const items = Array.isArray(found.items) ? found.items : [];
                    setEditableItems(items.map((item: OrderItem) => ({
                        name: item.name || item.product_name || 'منتج',
                        quantity: item.quantity || 1,
                        price: item.price || item.unit_price || 0,
                        notes: item.notes || ''
                    })));
                    setEditableDeliveryFee(found.delivery_fee || 0);
                    setEditableNotes(found.notes || '');
                }
            } else {
                console.error(data.error);
            }
        } catch (error) {
            console.error('Error fetching order:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Track changes
    useEffect(() => {
        if (!order) return;
        const originalItems = Array.isArray(order.items) ? order.items : [];
        const itemsChanged = JSON.stringify(editableItems) !== JSON.stringify(originalItems);
        const feeChanged = editableDeliveryFee !== (order.delivery_fee || 0);
        const notesChanged = editableNotes !== (order.notes || '');
        setHasChanges(itemsChanged || feeChanged || notesChanged);
    }, [editableItems, editableDeliveryFee, editableNotes, order]);

    const updateStatus = async (newStatus: string) => {
        if (!order) return;
        setUpdating(true);

        try {
            const data = await apiCall(`/halan/orders/${order.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });

            if (data.success) {
                setOrder({ ...order, status: newStatus });
            }
        } catch (error) {
            console.error('Error updating order:', error);
        } finally {
            setUpdating(false);
        }
    };

    // Save pricing inline
    const handleSavePricing = async () => {
        if (!order) return;
        setSaving(true);

        try {
            const data = await apiCall(`/halan/orders/${order.id}/courier-pricing`, {
                method: 'PATCH',
                body: JSON.stringify({
                    items: editableItems,
                    deliveryFee: editableDeliveryFee
                })
            });

            if (data.success) {
                setOrder({
                    ...order,
                    status: order.status === 'pending' || order.status === 'assigned' ? 'in_transit' : order.status,
                    items: editableItems,
                    delivery_fee: editableDeliveryFee
                });
                setHasChanges(false);
                setModalState({
                    isOpen: true,
                    title: 'تم الحفظ! ✅',
                    message: 'تم حفظ الأسعار بنجاح.',
                    type: 'success'
                });
            } else {
                setModalState({
                    isOpen: true,
                    title: 'خطأ',
                    message: data.error || 'حدث خطأ',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Pricing save error:', error);
            setModalState({
                isOpen: true,
                title: 'خطأ',
                message: 'فشل في حفظ الأسعار',
                type: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'قيد الانتظار';
            case 'assigned': return 'تم التعيين';
            case 'picked_up': return 'تم الاستلام';
            case 'in_transit': return 'جاري التوصيل';
            case 'delivered': return 'تم التوصيل';
            case 'cancelled': return 'ملغي';
            default: return status;
        }
    };

    const getNextStatus = (currentStatus: string) => {
        switch (currentStatus) {
            case 'pending': return { status: 'in_transit', label: 'قبول واستلام الطلب' };
            case 'assigned': return { status: 'in_transit', label: 'استلام وبدء التوصيل' };
            case 'picked_up': return { status: 'in_transit', label: 'بدء التوصيل' };
            case 'in_transit': return { status: 'delivered', label: 'تم التوصيل' };
            default: return null;
        }
    };

    const handleCall = () => {
        if (order?.customer_phone) {
            window.open(`tel:${order.customer_phone}`, '_self');
        }
    };

    const handleWhatsApp = () => {
        if (order?.customer_phone) {
            let phone = order.customer_phone.replace(/\D/g, '');
            if (!phone.startsWith('20')) phone = '20' + phone;
            window.open(`https://wa.me/${phone}`, '_blank');
        }
    };

    const updateItemName = (index: number, name: string) => {
        const newItems = [...editableItems];
        newItems[index].name = name;
        setEditableItems(newItems);

        if (name.trim()) {
            const filtered = allProducts.filter(p =>
                p.name.toLowerCase().includes(name.toLowerCase())
            );
            setSuggestions(filtered);
            setFocusedProductIndex(index);
        } else {
            setSuggestions([]);
        }
    };

    const handleSelectProduct = (index: number, name: string) => {
        const newItems = [...editableItems];
        newItems[index].name = name;
        setEditableItems(newItems);
        setSuggestions([]);
        setFocusedProductIndex(null);
    };

    // Item handlers
    const updateItemQuantity = (index: number, delta: number) => {
        const newItems = [...editableItems];
        newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
        setEditableItems(newItems);
    };

    const updateItemPrice = (index: number, price: number) => {
        const newItems = [...editableItems];
        newItems[index].price = price;
        setEditableItems(newItems);
    };

    const updateItemNotes = (index: number, notes: string) => {
        const newItems = [...editableItems];
        newItems[index].notes = notes;
        setEditableItems(newItems);
    };

    const addItem = () => {
        setEditableItems([...editableItems, { name: 'منتج جديد', quantity: 1, price: 0, notes: '' }]);
    };

    const removeItem = (index: number) => {
        if (editableItems.length > 1) {
            setEditableItems(editableItems.filter((_, i) => i !== index));
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">لم يتم العثور على الطلب</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 text-violet-600 font-medium"
                    >
                        العودة
                    </button>
                </div>
            </div>
        );
    }

    const nextStatus = getNextStatus(order.status);
    const isCourier = user?.role === 'courier';
    const canEdit = isCourier && order.status !== 'delivered' && order.status !== 'cancelled';

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-4 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2">
                    <ArrowRight className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                </button>
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex-1">
                    تفاصيل طلب {order.customer_name} (#{order.id})
                </h1>
                {order.is_modified_by_courier && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Edit3 className="w-3 h-3" />
                        معدل
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4 pb-32">
                {isCourier && (order.status === 'pending' || order.status === 'assigned') ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white dark:bg-slate-800 rounded-3xl shadow-sm">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6">
                            <Package className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">الطلب بانتظار الاستلام</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                            يرجى الضغط على زر "استلام وبدء التوصيل" بالأسفل لتتمكن من رؤية بيانات العميل وتفاصيل المنتجات.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Status Badge */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full font-bold">
                                <Clock className="w-5 h-5" />
                                {getStatusLabel(order.status)}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">بيانات العميل</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{order.customer_name}</p>
                                    <p className="text-slate-500 dark:text-slate-400">{order.customer_phone}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCall}
                                        className="w-11 h-11 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                    >
                                        <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </button>
                                    <button
                                        onClick={handleWhatsApp}
                                        className="w-11 h-11 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                    >
                                        <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Addresses */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">عنوان التوصيل</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Navigation className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">توصيل إلى</p>
                                        <p className="font-medium text-slate-800 dark:text-slate-200">{order.delivery_address}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Editable Products Section */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">المنتجات</h3>
                                {canEdit && (
                                    <button
                                        onClick={addItem}
                                        className="text-violet-600 dark:text-violet-400 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        إضافة
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                {editableItems.map((item, index) => (
                                    <div key={index} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 relative">
                                                {canEdit ? (
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={item.name}
                                                            onChange={(e) => updateItemName(index, e.target.value)}
                                                            onFocus={() => {
                                                                if (item.name.trim()) {
                                                                    const filtered = allProducts.filter(p =>
                                                                        p.name.toLowerCase().includes(item.name.toLowerCase())
                                                                    );
                                                                    setSuggestions(filtered);
                                                                    setFocusedProductIndex(index);
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                                setTimeout(() => {
                                                                    setSuggestions([]);
                                                                    setFocusedProductIndex(null);
                                                                }, 200);
                                                            }}
                                                            className="w-full font-bold bg-white dark:bg-slate-600 border dark:border-slate-500 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-white"
                                                        />
                                                        {focusedProductIndex === index && suggestions.length > 0 && (
                                                            <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[100] max-h-48 overflow-auto">
                                                                {suggestions.map((s) => (
                                                                    <div
                                                                        key={s.id}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
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
                                                ) : (
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                                                )}
                                            </div>
                                            {canEdit && editableItems.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full mr-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            {/* Quantity */}
                                            <div>
                                                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">الكمية</label>
                                                <div className="flex items-center bg-white dark:bg-slate-600 rounded-lg border dark:border-slate-500">
                                                    <button
                                                        onClick={() => updateItemQuantity(index, -1)}
                                                        disabled={!canEdit}
                                                        className="px-3 py-2 text-slate-600 dark:text-slate-200 disabled:opacity-50"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className="flex-1 text-center font-bold text-slate-800 dark:text-white">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateItemQuantity(index, 1)}
                                                        disabled={!canEdit}
                                                        className="px-3 py-2 text-slate-600 dark:text-slate-200 disabled:opacity-50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">السعر (ج.م)</label>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                                                    disabled={!canEdit}
                                                    className="w-full bg-white dark:bg-slate-600 text-slate-800 dark:text-white text-center font-bold py-2 rounded-lg border dark:border-slate-500 outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* Item Notes */}
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">ملاحظات المنتج</label>
                                            <input
                                                type="text"
                                                placeholder="مثال: كبير، بدون بصل..."
                                                value={item.notes || ''}
                                                onChange={(e) => updateItemNotes(index, e.target.value)}
                                                disabled={!canEdit}
                                                className="w-full bg-white dark:bg-slate-600 text-slate-800 dark:text-white py-2 px-3 rounded-lg border dark:border-slate-500 outline-none focus:ring-2 focus:ring-violet-500 text-sm disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Editable Delivery Fee */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                            <label className="font-bold text-slate-800 dark:text-slate-100 mb-3 block">رسوم التوصيل</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={editableDeliveryFee}
                                    onChange={(e) => setEditableDeliveryFee(parseFloat(e.target.value) || 0)}
                                    disabled={!canEdit}
                                    className="flex-1 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-2xl font-bold py-3 px-4 rounded-xl border dark:border-slate-600 outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                                />
                                <span className="text-slate-600 dark:text-slate-300 text-lg font-medium">ج.م</span>
                            </div>
                        </div>

                        {/* Order Notes */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5">
                            <label className="font-bold text-amber-800 dark:text-amber-400 mb-2 block">ملاحظات الطلب</label>
                            <textarea
                                value={editableNotes}
                                onChange={(e) => setEditableNotes(e.target.value)}
                                disabled={!canEdit}
                                placeholder="أضف ملاحظاتك هنا..."
                                className="w-full bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 py-3 px-4 rounded-xl border border-amber-200 dark:border-amber-700 outline-none focus:ring-2 focus:ring-amber-500 resize-none disabled:opacity-50"
                                rows={3}
                            />
                        </div>

                        {/* Invoice Summary */}
                        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <span>🧾</span>
                                ملخص الفاتورة
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-slate-300">
                                    <span>مجموع المنتجات ({editableItems.length})</span>
                                    <span>
                                        {editableItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0).toFixed(0)} ج.م
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>رسوم التوصيل</span>
                                    <span>{Number(editableDeliveryFee || 0).toFixed(0)} ج.م</span>
                                </div>
                                <div className="border-t border-slate-700 pt-3 mt-2 flex justify-between items-center font-bold text-xl">
                                    <span>الإجمالي</span>
                                    <span className="text-green-400">
                                        {(editableItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0) + Number(editableDeliveryFee || 0)).toFixed(0)} ج.م
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Courier Modifications Notice (for owner/supervisor) */}
                        {order.is_modified_by_courier && !isCourier && order.courier_modifications && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                    <h3 className="font-bold text-amber-800 dark:text-amber-400">تعديلات المندوب</h3>
                                </div>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                                    قام المندوب بتعديل الأسعار عند استلام الطلب
                                </p>
                                <div className="text-xs text-amber-600 space-y-1">
                                    <p>سعر التوصيل الأصلي: {order.courier_modifications.original_delivery_fee} ج.م</p>
                                    <p>سعر التوصيل الجديد: {order.courier_modifications.modified_delivery_fee} ج.م</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t dark:border-slate-800 p-4 space-y-3 z-50">
                {/* Save Changes Button */}
                {canEdit && hasChanges && (
                    <button
                        onClick={handleSavePricing}
                        disabled={saving}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                حفظ التغييرات
                            </>
                        )}
                    </button>
                )}

                {/* Status Action Button */}
                {isCourier && nextStatus && (
                    <button
                        onClick={() => {
                            if (hasChanges) {
                                // Save first then update status
                                handleSavePricing().then(() => updateStatus(nextStatus.status));
                            } else {
                                updateStatus(nextStatus.status);
                            }
                        }}
                        disabled={updating}
                        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                    >
                        {updating ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle className="w-6 h-6" />
                                {nextStatus.label}
                            </>
                        )}
                    </button>
                )}

                {/* Delivered Success */}
                {order.status === 'delivered' && (
                    <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl text-center">
                        <CheckCircle className="w-8 h-8 mx-auto text-green-600 dark:text-green-400 mb-1" />
                        <p className="text-green-700 dark:text-green-300 font-bold">تم التوصيل بنجاح</p>
                    </div>
                )}
            </div>

            <StatusModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                message={modalState.message}
                type={modalState.type}
            />
        </div>
    );
}
