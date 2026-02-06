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
                        displayedOrders.map((order, idx) => {
                            const statusInfo = getStatusInfo(order.status);
                            const StatusIcon = statusInfo.icon;
                            
                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Link href={`/orders/${order.id}`}>
                                        <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden bg-white">
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
                                                        <p className="text-lg font-black text-indigo-600 font-cairo">{order.price || '??'} ج.م</p>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-full border border-slate-100 group-hover:translate-x-[-4px] transition-transform">
                                                        <ChevronLeft className="w-4 h-4 text-indigo-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
