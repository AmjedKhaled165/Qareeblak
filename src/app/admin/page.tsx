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

    if (!isInitialized) return <div className="p-10 text-center text-muted-foreground font-cairo">جاري التحميل...</div>;

    const pendingRequests = requests.filter(r => r.status === 'pending');

    const stats = [
        { label: "طلبات معلقة", value: pendingRequests.length.toString(), icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10" },
        { label: "مقدمي الخدمات", value: (providers || []).length.toString(), icon: Store, color: "text-indigo-400", bg: "bg-indigo-400/10" },
        { label: "إجمالي الحجوزات", value: (bookings || []).length.toString(), icon: ShoppingBag, color: "text-emerald-400", bg: "bg-emerald-400/10" },
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
                    <h1 className="text-3xl font-bold tracking-tight text-foreground font-cairo">لوحة التحكم</h1>
                    <p className="text-muted-foreground mt-2 font-cairo">نظرة عامة على أداء المنصة والطلبات.</p>
                </div>
            </header>

            {/* Custom Tabs */}
            <div className="space-y-6">
                <div className="flex p-1 bg-muted/30 rounded-2xl w-fit border border-border/50">
                    {(['overview', 'requests', 'providers', 'bookings'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                relative px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 font-cairo
                                ${activeTab === tab
                                    ? "text-foreground shadow-lg bg-card border border-border/50"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }
                            `}
                        >
                            {tab === 'overview' && "نظرة عامة"}
                            {tab === 'requests' && (
                                <span className="flex items-center gap-2">
                                    الطلبات
                                    {pendingRequests.length > 0 && (
                                        <span className="bg-destructive text-destructive-foreground text-[10px] px-2 py-0.5 rounded-full animate-pulse">
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
                                    <Card key={index} className="border-border/50 shadow-sm overflow-hidden bg-card rounded-[1.5rem]">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between space-y-0 pb-2">
                                                <p className="text-sm font-bold text-muted-foreground font-cairo">{stat.label}</p>
                                                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                                </div>
                                            </div>
                                            <div className="text-3xl font-black mt-2">{stat.value}</div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Pending Requests */}
                                <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden">
                                    <CardHeader className="bg-muted/30 pb-4">
                                        <CardTitle className="flex items-center gap-2 font-cairo">
                                            طلبات الانضمام
                                            {pendingRequests.length > 0 && (
                                                <span className="bg-orange-500/10 text-orange-500 text-xs px-2.5 py-1 rounded-full font-bold">
                                                    {pendingRequests.length} معلق
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="font-cairo">طلبات تحتاج مراجعتك</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            {pendingRequests.slice(0, 5).map(req => (
                                                <div key={req.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-bold text-foreground">{req.name}</p>
                                                        <p className="text-sm text-muted-foreground">{req.category}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" onClick={() => handleApprove(req.id, req.name)}>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => handleReject(req.id, req.name)}>
                                                            <XCircle className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {pendingRequests.length === 0 && (
                                                <p className="text-center text-muted-foreground py-4 font-cairo">لا توجد طلبات جديدة ✨</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Recent Providers */}
                                <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden">
                                    <CardHeader className="bg-muted/30 pb-4">
                                        <CardTitle className="font-cairo">مقدمي الخدمات</CardTitle>
                                        <CardDescription className="font-cairo">المسجلين في المنصة</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            {(providers || []).slice(0, 5).map(prov => (
                                                <div key={prov.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-bold text-foreground">{prov.name}</p>
                                                        <p className="text-sm text-muted-foreground">{prov.category}</p>
                                                    </div>
                                                    <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full text-xs font-bold">نشط</span>
                                                </div>
                                            ))}
                                            {(providers || []).length === 0 && (
                                                <p className="text-center text-muted-foreground py-4 font-cairo">لا يوجد مقدمي خدمات بعد</p>
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
                            <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden">
                                <CardHeader className="bg-muted/30 pb-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="font-cairo">طلبات الانضمام</CardTitle>
                                            <CardDescription className="font-cairo">قبول أو رفض طلبات مقدمي الخدمات الجدد</CardDescription>
                                        </div>
                                        <div className="relative w-full md:w-64">
                                            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="بحث عن طلب..."
                                                className="pr-10 h-10 rounded-xl bg-background border-border/50"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 px-4 md:px-6">
                                    {loadingRequests ? (
                                        <p className="text-center py-10 text-muted-foreground font-cairo">جاري التحميل...</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {filteredRequests.filter(r => r.status === 'pending').length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground">
                                                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p className="font-cairo text-lg">لا توجد طلبات معلقة 🎉</p>
                                                </div>
                                            ) : (
                                                filteredRequests.filter(r => r.status === 'pending').map((req) => (
                                                    <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-border/50 rounded-2xl bg-muted/20 hover:bg-muted/30 transition-all gap-4">
                                                        <div className="flex items-center gap-4 text-right">
                                                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl border border-primary/20">
                                                                {req.name[0]}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-foreground text-lg">{req.name}</h4>
                                                                <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-3 mt-1 font-medium">
                                                                    <span className="bg-background px-2 py-0.5 rounded-lg border border-border/50">{req.category}</span>
                                                                    <span className="hidden md:inline">•</span>
                                                                    <span>{req.phone}</span>
                                                                    <span className="hidden md:inline">•</span>
                                                                    <span>{req.location}</span>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1 opacity-70">{req.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button className="flex-1 md:flex-none h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold font-cairo px-6" onClick={() => handleApprove(req.id, req.name)}>
                                                                <CheckCircle2 className="w-4 h-4 ml-2" />
                                                                قبول
                                                            </Button>
                                                            <Button variant="outline" className="flex-1 md:flex-none h-11 border-destructive/50 text-destructive hover:bg-destructive/10 rounded-xl font-bold font-cairo px-6" onClick={() => handleReject(req.id, req.name)}>
                                                                <XCircle className="w-4 h-4 ml-2" />
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
                            <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden">
                                <CardHeader className="bg-muted/30">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="font-cairo">مقدمي الخدمات</CardTitle>
                                            <CardDescription className="font-cairo">إدارة مقدمي الخدمات المسجلين</CardDescription>
                                        </div>
                                        <div className="relative w-full md:w-64">
                                            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="بحث عن مقدم خدمة..."
                                                className="pr-10 h-10 rounded-xl bg-background border-border/50"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="space-y-3">
                                        {filteredProviders.length === 0 ? (
                                            <p className="text-center py-10 text-muted-foreground font-cairo">لا يوجد مقدمي خدمات</p>
                                        ) : (
                                            filteredProviders.map((prov) => (
                                                <div key={prov.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition-all border border-transparent hover:border-border/50 gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl border border-border/50">
                                                            🏪
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-foreground">{prov.name}</p>
                                                            <p className="text-xs text-muted-foreground font-medium">{prov.category} • {prov.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                        <div className="flex items-center gap-1 font-bold text-foreground">
                                                            <span className="text-amber-400 text-lg">⭐</span>
                                                            {prov.rating}
                                                        </div>
                                                        <div className="text-xs">{prov.reviews} تقييم</div>
                                                        <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">نشط</span>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-10 w-10"
                                                            disabled={isLoading}
                                                            onClick={() => handleDeleteProvider(prov.id, prov.name)}
                                                        >
                                                            <Trash2 className="h-5 w-5" />
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
                            <Card className="bg-card border-border/50 rounded-[2rem] overflow-hidden">
                                <CardHeader className="bg-muted/30">
                                    <CardTitle className="font-cairo">سجل الحجوزات</CardTitle>
                                    <CardDescription className="font-cairo">متابعة جميع العمليات</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        {filteredBookings.length === 0 ? (
                                            <p className="text-center text-muted-foreground py-10 font-cairo">لا توجد حجوزات حتى الآن</p>
                                        ) : (
                                            <div className="border border-border/50 rounded-2xl overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-right">
                                                        <thead className="bg-muted text-muted-foreground font-black font-cairo border-b border-border/50">
                                                            <tr>
                                                                <th className="p-4">العميل</th>
                                                                <th className="p-4">مقدم الخدمة</th>
                                                                <th className="p-4">الخدمة</th>
                                                                <th className="p-4">الحالة</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/50 font-medium font-cairo">
                                                            {filteredBookings.map((book) => (
                                                                <tr key={book.id} className="hover:bg-muted/30 transition-colors">
                                                                    <td className="p-4 font-black text-foreground">{book.userName}</td>
                                                                    <td className="p-4 text-muted-foreground">{book.providerName}</td>
                                                                    <td className="p-4 text-muted-foreground">{book.serviceName}</td>
                                                                    <td className="p-4">
                                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black
                                                                            ${book.status === 'confirmed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : ''}
                                                                            ${book.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : ''}
                                                                            ${book.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                                                                            ${book.status === 'rejected' ? 'bg-destructive/10 text-destructive border border-destructive/20' : ''}
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
