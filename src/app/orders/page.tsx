"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/components/providers/AppProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingBag, ChevronLeft, Clock, MapPin, CheckCircle2, Package, Truck, XCircle, ChevronRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { bookingsApi } from "@/lib/api";

export default function MyOrdersPage() {
    const router = useRouter();
    const { currentUser } = useAppStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'previous'>('active');

    useEffect(() => {
        if (!currentUser) {
            router.push("/login");
            return;
        }
        fetchOrders();
    }, [currentUser]);

    const fetchOrders = async () => {
        try {
            if (!currentUser?.id) return;
            const data = await bookingsApi.getByUser(currentUser.id.toString());
            setOrders(data);
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const activeOrders = orders.filter(o => ['pending', 'confirmed'].includes(o.status));
    const previousOrders = orders.filter(o => !['pending', 'confirmed'].includes(o.status));

    const displayedOrders = activeTab === 'active' ? activeOrders : previousOrders;

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'pending': return { label: 'انتظار الموافقة', color: 'text-orange-500 bg-orange-50', icon: Clock };
            case 'confirmed': return { label: 'جاري التجهيز', color: 'text-blue-500 bg-blue-50', icon: Package };
            case 'completed': return { label: 'مكتمل', color: 'text-green-500 bg-green-50', icon: CheckCircle2 };
            case 'cancelled': return { label: 'ملغي', color: 'text-red-500 bg-red-50', icon: XCircle };
            case 'rejected': return { label: 'مرفوض', color: 'text-red-500 bg-red-50', icon: XCircle };
            default: return { label: status, color: 'text-slate-500 bg-slate-50', icon: Clock };
        }
    };

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8" dir="rtl">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/" title="الرئيسية">
                        <Button variant="ghost" size="icon" className="rounded-full" title="الرئيسية">
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold font-cairo">طلباتي</h1>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchOrders}
                        className="mr-auto text-indigo-600 hover:bg-indigo-50"
                        title="تحديث القائمة"
                    >
                        تحديث
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Clock className="w-4 h-4" />
                        الطلبات النشطة ({activeOrders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('previous')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'previous' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        السجل ({previousOrders.length})
                    </button>
                </div>

                {/* Orders List */}
                <div className="space-y-4">
                    {isLoading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />
                        ))
                    ) : displayedOrders.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShoppingBag className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400">لا توجد طلبات هنا</h3>
                            <Link href="/">
                                <Button className="mt-4 bg-indigo-600">اطلب الآن من أفضل المطاعم</Button>
                            </Link>
                        </div>
                    ) : (
                        (() => {
                            // Group orders by parentOrderId or bundleId
                            const grouped: Record<string, any[]> = {};
                            const singles: any[] = [];

                            displayedOrders.forEach(order => {
                                const gid = order.parentOrderId || order.bundleId;
                                if (gid) {
                                    if (!grouped[gid]) grouped[gid] = [];
                                    grouped[gid].push(order);
                                } else {
                                    singles.push(order);
                                }
                            });

                            // Combine into a display list
                            // We will use a mixed array: singular orders and "bundle" objects
                            const displayItems = [
                                ...singles.map(o => ({ type: 'single', data: o })),
                                ...Object.values(grouped).map(group => ({ type: 'bundle', data: group }))
                            ].sort((a, b) => {
                                const dateA = new Date(a.type === 'single' ? a.data.date : a.data[0].date).getTime();
                                const dateB = new Date(b.type === 'single' ? b.data.date : b.data[0].date).getTime();
                                return dateB - dateA;
                            });

                            return displayItems.map((item, idx) => {
                                if (item.type === 'bundle') {
                                    const group = item.data;
                                    const firstOrder = group[0];
                                    const totalAmount = group.reduce((sum: number, o: any) => {
                                        if (Number(o.price) > 0) return sum + Number(o.price);
                                        const orderItems = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items || '[]') : []);
                                        const itemsPrice = orderItems.reduce((s: number, i: any) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                        return sum + itemsPrice;
                                    }, 0);
                                    const providersCount = new Set(group.map((o: any) => o.providerId)).size;
                                    const itemsCount = group.reduce((sum: number, o: any) => sum + (o.items ? o.items.length : 0), 0);

                                    return (
                                        <motion.div
                                            key={`bundle-${firstOrder.bundleId}`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-4 space-y-3"
                                        >
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                                                        {group.length}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-indigo-900">طلب مجمع</h3>
                                                        <p className="text-xs text-indigo-600 font-medium">يحتوي على {group.length} طلبات فرعية من {providersCount} متاجر</p>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-lg font-black text-indigo-700 font-cairo">{totalAmount} ج.م</p>
                                                    <p className="text-[10px] text-indigo-400 font-bold">{new Date(firstOrder.date).toLocaleDateString('ar-EG')}</p>
                                                </div>
                                            </div>

                                            {/* Children Orders */}
                                            <div className="space-y-3 pt-2">
                                                {group.map((order: any) => {
                                                    const statusInfo = getStatusInfo(order.status);
                                                    const StatusIcon = statusInfo.icon;

                                                    return (
                                                        <Link key={order.id} href={`/track/${order.id}`}>
                                                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all flex items-center justify-between cursor-pointer group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-2 h-12 rounded-full ${statusInfo.color.split(' ')[1]}`} />
                                                                    <div>
                                                                        <h4 className="font-bold text-slate-800">{order.providerName}</h4>
                                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                            <span className={`px-2 py-0.5 rounded-md ${statusInfo.color} font-bold`}>
                                                                                {statusInfo.label}
                                                                            </span>
                                                                            <span>• {order.serviceName}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-bold text-slate-700">
                                                                        {(() => {
                                                                            if (Number(order.price) > 0) return order.price;
                                                                            const itemsArr = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
                                                                            if (itemsArr.length > 0) {
                                                                                return itemsArr.reduce((sum: number, i: any) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                                                            }
                                                                            return order.price || '0';
                                                                        })()} ج.م
                                                                    </span>
                                                                    <ChevronLeft className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    );
                                }

                                const order = item.data;
                                const statusInfo = getStatusInfo(order.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Link href={`/track/${order.id}`}>
                                            <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden bg-white border border-slate-200">
                                                <CardContent className="p-0">
                                                    <div className="p-5 flex justify-between items-start border-b border-slate-50">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-bold text-lg font-cairo text-slate-800">{order.providerName}</h3>
                                                                {order.halanOrderId && (
                                                                    <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                                                                        <Truck className="w-3 h-3" />
                                                                        دليفري سريع
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-slate-500 flex items-center gap-1 font-bold">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {new Date(order.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </p>
                                                        </div>
                                                        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold ${statusInfo.color}`}>
                                                            <StatusIcon className="w-3.5 h-3.5" />
                                                            {statusInfo.label}
                                                        </div>
                                                    </div>

                                                    <div className="p-5 bg-slate-50/30 flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="text-xs text-slate-400 font-bold">الخدمة / الطلب:</p>
                                                            <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{order.serviceName}</p>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-xs text-slate-400 font-bold mb-1">المبلغ الإجمالي:</p>
                                                            <p className="text-lg font-black text-indigo-600 font-cairo">
                                                                {(() => {
                                                                    if (Number(order.price) > 0) return order.price;
                                                                    const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
                                                                    if (items.length > 0) {
                                                                        return items.reduce((sum: number, i: any) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
                                                                    }
                                                                    return order.price || '0';
                                                                })()} ج.م
                                                            </p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded-full border border-slate-100 group-hover:translate-x-[-4px] transition-transform">
                                                            <ChevronLeft className="w-4 h-4 text-indigo-600" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    </motion.div>
                                );
                            });
                        })()
                    )}
                </div>
            </div>
        </div>
    );
}
