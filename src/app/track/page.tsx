"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, MapPin, Truck, ChevronLeft, Clock, ShoppingBag, Loader2 } from "lucide-react";
import { useAppStore } from "@/components/providers/AppProvider";

// Define Order Interface inline
interface Order {
    id: string | number;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    status: string;
    items: any[];
    delivery_fee: number;
    created_at: string;
    courier_name?: string;
    total_price?: number;
    is_parent?: boolean;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api$/, '').replace(/\/$/, '');

export default function TrackSearchPage() {
    const router = useRouter();
    const { currentUser, isInitialized } = useAppStore();

    // State
    const [phone, setPhone] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [viewMode, setViewMode] = useState<'search' | 'list'>('search'); // 'search' for phone input, 'list' for orders list
    const [error, setError] = useState("");

    // Initialize: If user logged in, use their phone and ID
    useEffect(() => {
        if (!isInitialized) return;

        // Initialize: If user logged in or has history, PRE-FILL the phone but DON'T auto-search.
        // The user wants to see the "Enter Number" screen first.

        let initialPhone = "";

        // 1. If user is logged in
        if (currentUser?.phone) {
            console.log("Logged in user phone pre-filled:", currentUser.phone);
            initialPhone = currentUser.phone;
        }
        // 2. Fallback to localStorage
        else {
            const storedHalanUser = localStorage.getItem('halan_user');
            if (storedHalanUser) {
                try {
                    const halanUser = JSON.parse(storedHalanUser);
                    if (halanUser.phone) initialPhone = halanUser.phone;
                } catch (e) { }
            }

            if (!initialPhone) {
                const savedPhone = localStorage.getItem('last_track_phone');
                if (savedPhone) initialPhone = savedPhone;
            }
        }

        if (initialPhone) {
            setPhone(initialPhone);
        }

    }, [currentUser, isInitialized]);

    const fetchOrders = async (phoneToSearch: string, userId?: string | number) => {
        if (!phoneToSearch && !userId) return;

        setIsLoadingOrders(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE}/api/halan/orders/customer-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneToSearch, userId: userId })
            });
            const data = await response.json();

            if (data.success) {
                setOrders(data.orders);
                setViewMode('list');
                localStorage.setItem('last_track_phone', phoneToSearch);
            } else {
                setOrders([]);
                // Don't switch view mode on error, maybe just show toast
                if (viewMode === 'search') setError("لم يتم العثور على طلبات لهذا الرقم");
            }
        } catch (err) {
            console.error(err);
            setError("حدث خطأ في الاتصال");
        } finally {
            setIsLoadingOrders(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchOrders(phone);
    };

    // Status helpers
    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            pending: 'تم استلام الطلب',
            assigned: 'تم تعيين المندوب',
            ready_for_pickup: 'تم تحضير الطلب',
            picked_up: 'جاري التوصيل',
            in_transit: 'جاري التوصيل',
            delivered: 'تم التوصيل',
            cancelled: 'ملغي'
        };
        return map[status] || status;
    };

    const getStatusColor = (status: string) => {
        const map: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            ready_for_pickup: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            picked_up: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            in_transit: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
            delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        };
        return map[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-4 pb-24" dir="rtl">

            {/* Header */}
            <div className="w-full max-w-md pt-8 mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">طلباتي</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">تابع حالة طلباتك الحالية والسابقة</p>
                </div>
                {!currentUser && viewMode === 'list' && (
                    <button
                        onClick={() => setViewMode('search')}
                        className="text-sm text-violet-600 font-medium hover:underline"
                    >
                        تغيير الرقم
                    </button>
                )}
            </div>

            {/* Content Switcher */}
            <div className="w-full max-w-md relative">
                <AnimatePresence mode="wait">

                    {/* View 1: Phone Search (Only if not logged in or no orders found initially) */}
                    {viewMode === 'search' && (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex justify-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-400">
                                    <ShoppingBag className="w-8 h-8" />
                                </div>
                            </div>

                            <h2 className="text-xl font-bold mb-2">أدخل رقم الهاتف</h2>
                            <p className="text-slate-500 mb-6 text-sm">أدخل رقم الهاتف الذي استخدمته في الطلب لعرض جميع طلباتك</p>

                            <form onSubmit={handleSearchSubmit} className="space-y-4">
                                <div>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="رقم الهاتف (مثال: 010xxxxxxx)"
                                        className="w-full bg-slate-50 dark:bg-slate-700/50 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-4 px-4 text-center font-bold text-lg outline-none focus:border-violet-500 transition-colors ltr"
                                        dir="ltr"
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-500 text-sm font-medium">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={!phone.trim() || isLoadingOrders}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-4 font-bold text-lg shadow-lg shadow-violet-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isLoadingOrders ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        'عرض الطلبات'
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* View 2: Orders List */}
                    {viewMode === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            {isLoadingOrders ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-violet-500" />
                                    <p>جاري تحميل الطلبات...</p>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">لا توجد طلبات سابقة</h3>
                                    <p className="text-slate-500 text-sm mt-2 px-8">لم نتمكن من العثور على أي طلبات مرتبطة برقم الهاتف هذا.</p>
                                    <button
                                        onClick={() => setViewMode('search')}
                                        className="mt-6 text-violet-600 font-bold text-sm hover:underline"
                                    >
                                        بحث برقم آخر
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order) => (
                                        <motion.div
                                            key={order.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => router.push(`/track/${order.id}`)}
                                            className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-violet-500/30 transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(order.status)} bg-opacity-20`}>
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 dark:text-white">طلب #{order.id}</h3>
                                                        <p className="text-xs text-slate-400">
                                                            {new Date(order.created_at).toLocaleDateString('ar-EG', {
                                                                day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <ShoppingBag className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate">
                                                        {order.items?.length > 0
                                                            ? order.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')
                                                            : 'تفاصيل الطلب...'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <MapPin className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate">{order.delivery_address}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                                                <span className="font-bold text-lg text-slate-800 dark:text-white">
                                                    {order.total_price || (
                                                        ((order.items?.reduce((s: number, i: any) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0) || 0) +
                                                            Number(order.delivery_fee || 0))
                                                    ).toFixed(0)} ج.م
                                                </span>
                                                <div className="flex items-center text-violet-600 font-bold text-sm group-hover:translate-x-1 group-hover:-translate-x-1 transition-transform rtl:flex-row-reverse">
                                                    تتبع التفاصيل <ChevronLeft className="w-4 h-4 mr-1" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
