"use client";

import { useAppStore } from "@/hooks/use-app-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Store, Search, Trash2, ShoppingBag, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { motion, AnimatePresence } from "framer-motion";
import { requestsApi } from "@/lib/api";

interface ProviderRequest {
    id: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    location: string;
    status: 'pending' | 'approved' | 'rejected';
    date: string;
}

export default function AdminDashboard() {
    const { providers, bookings, deleteProvider, refreshProviders, isInitialized, isLoading } = useAppStore();
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'providers' | 'bookings'>('overview');
    const [searchTerm, setSearchTerm] = useState("");
    const [requests, setRequests] = useState<ProviderRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    // Fetch requests on mount and when tab changes
    useEffect(() => {
        if (activeTab === 'requests' || activeTab === 'overview') {
            loadRequests();
        }
    }, [activeTab]);

    const loadRequests = async () => {
        try {
            setLoadingRequests(true);
            const data = await requestsApi.getAll();
            setRequests(data);
        } catch (error) {
            console.error("Failed to load requests:", error);
        } finally {
            setLoadingRequests(false);
        }
    };

    if (!isInitialized) return <div className="p-10 text-center text-slate-500">جاري التحميل...</div>;

    const pendingRequests = requests.filter(r => r.status === 'pending');

    const stats = [
        { label: "طلبات معلقة", value: pendingRequests.length.toString(), icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
        { label: "مقدمي الخدمات", value: (providers || []).length.toString(), icon: Store, color: "text-purple-600", bg: "bg-purple-100" },
        { label: "إجمالي الحجوزات", value: (bookings || []).length.toString(), icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-100" },
    ];

    const handleApprove = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'قبول مقدم الخدمة',
            message: `هل أنت متأكد من قبول "${name}"؟ سيتمكن من تسجيل الدخول وإضافة خدماته.`,
            confirmText: 'نعم، قبول',
            cancelText: 'إلغاء',
            type: 'info'
        });

        if (confirmed) {
            try {
                await requestsApi.approve(id);
                toast(`تم قبول "${name}" بنجاح!`, "success");
                await loadRequests();
                await refreshProviders();
            } catch (error) {
                toast("حدث خطأ في قبول الطلب", "error");
            }
        }
    };

    const handleReject = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'رفض الطلب',
            message: `هل أنت متأكد من رفض طلب "${name}"؟`,
            confirmText: 'نعم، رفض',
            cancelText: 'إلغاء',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await requestsApi.reject(id);
                toast(`تم رفض طلب "${name}"`, "info");
                await loadRequests();
            } catch (error) {
                toast("حدث خطأ في رفض الطلب", "error");
            }
        }
    };

    const handleDeleteProvider = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'حذف مقدم الخدمة',
            message: `هل أنت متأكد من حذف "${name}"؟ سيتم حذف جميع خدماته وحجوزاته نهائياً.`,
            confirmText: 'نعم، احذف',
            cancelText: 'إلغاء',
            type: 'danger'
        });

        if (confirmed) {
            const success = await deleteProvider(id);
            if (success) {
                toast(`تم حذف "${name}" بنجاح!`, "success");
            } else {
                toast("حدث خطأ في حذف مقدم الخدمة", "error");
            }
        }
    };

    // Filter providers
    const filteredProviders = (providers || []).filter(prov =>
        prov.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prov.category.includes(searchTerm)
    );

    // Filter bookings
    const filteredBookings = (bookings || []).filter(booking =>
        booking.userName.includes(searchTerm) ||
        booking.serviceName.includes(searchTerm)
    );

    // Filter requests
    const filteredRequests = requests.filter(req =>
        req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.category.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">لوحة التحكم</h1>
                    <p className="text-slate-500 mt-2">نظرة عامة على أداء المنصة والطلبات.</p>
                </div>
            </header>

            {/* Custom Tabs */}
            <div className="space-y-6">
                <div className="flex p-1 bg-slate-100/80 rounded-xl w-fit">
                    {(['overview', 'requests', 'providers', 'bookings'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                                ${activeTab === tab
                                    ? "text-slate-900 shadow-sm bg-white"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                }
                            `}
                        >
                            {tab === 'overview' && "نظرة عامة"}
                            {tab === 'requests' && (
                                <span className="flex items-center gap-2">
                                    الطلبات
                                    {pendingRequests.length > 0 && (
                                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                                            {pendingRequests.length}
                                        </span>
                                    )}
                                </span>
                            )}
                            {tab === 'providers' && "مقدمي الخدمات"}
                            {tab === 'bookings' && "الحجوزات"}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Stats Cards */}
                            <div className="grid gap-4 md:grid-cols-3">
                                {stats.map((stat, index) => (
                                    <Card key={index} className="border-none shadow-sm overflow-hidden">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between space-y-0 pb-2">
                                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                                </div>
                                            </div>
                                            <div className="text-2xl font-bold">{stat.value}</div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Pending Requests */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            طلبات الانضمام
                                            {pendingRequests.length > 0 && (
                                                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                                                    {pendingRequests.length} معلق
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription>طلبات تحتاج مراجعتك</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {pendingRequests.slice(0, 5).map(req => (
                                                <div key={req.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-semibold">{req.name}</p>
                                                        <p className="text-sm text-slate-500">{req.category}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id, req.name)}>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleReject(req.id, req.name)}>
                                                            <XCircle className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {pendingRequests.length === 0 && (
                                                <p className="text-center text-slate-500 py-4">لا توجد طلبات جديدة ✨</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Recent Providers */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>مقدمي الخدمات</CardTitle>
                                        <CardDescription>المسجلين في المنصة</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {(providers || []).slice(0, 5).map(prov => (
                                                <div key={prov.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-semibold">{prov.name}</p>
                                                        <p className="text-sm text-slate-500">{prov.category}</p>
                                                    </div>
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">نشط</span>
                                                </div>
                                            ))}
                                            {(providers || []).length === 0 && (
                                                <p className="text-center text-slate-500 py-4">لا يوجد مقدمي خدمات بعد</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {/* REQUESTS TAB */}
                    {activeTab === 'requests' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>طلبات الانضمام</CardTitle>
                                            <CardDescription>قبول أو رفض طلبات مقدمي الخدمات الجدد</CardDescription>
                                        </div>
                                        <div className="relative w-64">
                                            <Search className="absolute right-2 top-2.5 h-4 w-4 text-slate-500" />
                                            <Input
                                                placeholder="بحث عن طلب..."
                                                className="pr-8"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {loadingRequests ? (
                                        <p className="text-center py-10 text-slate-500">جاري التحميل...</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {filteredRequests.filter(r => r.status === 'pending').length === 0 ? (
                                                <div className="text-center py-10 text-slate-500">
                                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                                    <p>لا توجد طلبات معلقة 🎉</p>
                                                </div>
                                            ) : (
                                                filteredRequests.filter(r => r.status === 'pending').map((req) => (
                                                    <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                                                {req.name[0]}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold">{req.name}</h4>
                                                                <div className="flex items-center text-sm text-slate-500 gap-3">
                                                                    <span>{req.category}</span>
                                                                    <span>•</span>
                                                                    <span>{req.phone}</span>
                                                                    <span>•</span>
                                                                    <span>{req.location}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-400">{req.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(req.id, req.name)}>
                                                                <CheckCircle2 className="w-4 h-4 ml-1" />
                                                                قبول
                                                            </Button>
                                                            <Button variant="destructive" onClick={() => handleReject(req.id, req.name)}>
                                                                <XCircle className="w-4 h-4 ml-1" />
                                                                رفض
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* PROVIDERS TAB */}
                    {activeTab === 'providers' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>مقدمي الخدمات</CardTitle>
                                    <CardDescription>إدارة مقدمي الخدمات المسجلين</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative mb-4">
                                        <Search className="absolute right-2 top-2.5 h-4 w-4 text-slate-500" />
                                        <Input
                                            placeholder="بحث عن مقدم خدمة..."
                                            className="pr-8"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        {filteredProviders.length === 0 ? (
                                            <p className="text-center py-10 text-slate-500">لا يوجد مقدمي خدمات</p>
                                        ) : (
                                            filteredProviders.map((prov) => (
                                                <div key={prov.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center text-xl">
                                                            🏪
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{prov.name}</p>
                                                            <p className="text-xs text-slate-500">{prov.category} • {prov.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-slate-600">
                                                        <span>⭐ {prov.rating}</span>
                                                        <span>{prov.reviews} تقييم</span>
                                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">نشط</span>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={isLoading}
                                                            onClick={() => handleDeleteProvider(prov.id, prov.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* BOOKINGS TAB */}
                    {activeTab === 'bookings' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>سجل الحجوزات</CardTitle>
                                    <CardDescription>متابعة جميع العمليات</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {filteredBookings.length === 0 ? (
                                            <p className="text-center text-slate-500 py-10">لا توجد حجوزات حتى الآن</p>
                                        ) : (
                                            <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm text-right">
                                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                                        <tr>
                                                            <th className="p-3">العميل</th>
                                                            <th className="p-3">مقدم الخدمة</th>
                                                            <th className="p-3">الخدمة</th>
                                                            <th className="p-3">الحالة</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {filteredBookings.map((book) => (
                                                            <tr key={book.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="p-3 font-medium">{book.userName}</td>
                                                                <td className="p-3 text-slate-600">{book.providerName}</td>
                                                                <td className="p-3">{book.serviceName}</td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                                        ${book.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : ''}
                                                                        ${book.status === 'pending' ? 'bg-orange-100 text-orange-700' : ''}
                                                                        ${book.status === 'completed' ? 'bg-blue-100 text-blue-700' : ''}
                                                                        ${book.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                                                                    `}>
                                                                        {book.status === 'confirmed' && 'جاري التنفيذ'}
                                                                        {book.status === 'pending' && 'قيد الانتظار'}
                                                                        {book.status === 'completed' && 'مكتمل'}
                                                                        {book.status === 'rejected' && 'مرفوض'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
