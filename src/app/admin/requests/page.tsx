"use client";

import { useState, useEffect, useCallback } from "react";
import {
    FileText, Search, RefreshCw, CheckCircle2, XCircle, Clock,
    Phone, Mail, MapPin, Store, UserCheck, ShieldAlert, Eye,
    Filter, AlertCircle, ChevronLeft, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { requestsApi } from "@/lib/api";

interface ProviderRequest {
    id: string | number;
    name: string;
    email: string;
    phone: string;
    category: string;
    location: string;
    status: "pending" | "approved" | "rejected";
    created_at?: string;
    date?: string;
    notes?: string;
    details?: string;
}

export default function AdminRequestsPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();

    const [requests, setRequests] = useState<ProviderRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    
    // Details Modal
    const [selectedReq, setSelectedReq] = useState<ProviderRequest | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | number | null>(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const data = await requestsApi.getAll();
            setRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load requests:", error);
            toast("تعذر تحميل طلبات الانضمام", "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleApprove = async (reqItem: ProviderRequest) => {
        const confirmed = await confirm({
            title: "قبول مقدم الخدمة",
            message: `هل أنت متأكد من قبول طلب "${reqItem.name}"؟ سيتم تفعيل حسابه كمقدم خدمة فوراً.`,
            confirmText: "نعم، قبول الطلب",
            cancelText: "إلغاء",
            type: "info",
        });

        if (!confirmed) return;

        setActionLoading(reqItem.id);
        try {
            await requestsApi.approve(String(reqItem.id));
            toast(`تم قبول "${reqItem.name}" بنجاح! 🎉`, "success");
            setRequests(prev => prev.map(r => r.id === reqItem.id ? { ...r, status: "approved" } : r));
            if (selectedReq?.id === reqItem.id) {
                setSelectedReq(prev => prev ? { ...prev, status: "approved" } : null);
            }
        } catch (error: any) {
            toast(error.message || "حدث خطأ أثناء قبول الطلب", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (reqItem: ProviderRequest) => {
        const confirmed = await confirm({
            title: "رفض طلب الانضمام",
            message: `هل أنت متأكد من رفض طلب "${reqItem.name}"؟`,
            confirmText: "رفض الطلب",
            cancelText: "تراجع",
            type: "danger",
        });

        if (!confirmed) return;

        setActionLoading(reqItem.id);
        try {
            await requestsApi.reject(String(reqItem.id));
            toast(`تم رفض طلب "${reqItem.name}"`, "info");
            setRequests(prev => prev.map(r => r.id === reqItem.id ? { ...r, status: "rejected" } : r));
            if (selectedReq?.id === reqItem.id) {
                setSelectedReq(prev => prev ? { ...prev, status: "rejected" } : null);
            }
        } catch (error: any) {
            toast(error.message || "حدث خطأ أثناء رفض الطلب", "error");
        } finally {
            setActionLoading(null);
        }
    };

    // Filtered data
    const filteredRequests = requests.filter(req => {
        const matchesStatus = statusFilter === "all" || req.status === statusFilter;
        const matchesSearch =
            !search.trim() ||
            (req.name && req.name.toLowerCase().includes(search.toLowerCase())) ||
            (req.phone && req.phone.includes(search)) ||
            (req.email && req.email.toLowerCase().includes(search.toLowerCase())) ||
            (req.category && req.category.toLowerCase().includes(search.toLowerCase())) ||
            (req.location && req.location.toLowerCase().includes(search.toLowerCase()));

        return matchesStatus && matchesSearch;
    });

    const pendingCount = requests.filter(r => r.status === "pending").length;
    const approvedCount = requests.filter(r => r.status === "approved").length;
    const rejectedCount = requests.filter(r => r.status === "rejected").length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <FileText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        طلبات الانضمام لمقدمي الخدمات
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        مراجعة واعتماد طلبات التجار والحرفيين والشركاء الجدد للانضمام لمنصة قريبلك
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={loadRequests}
                    disabled={loading}
                    className="gap-2 self-start sm:self-auto border-slate-200 dark:border-slate-800"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    تحديث
                </Button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card
                    onClick={() => setStatusFilter("all")}
                    className={`cursor-pointer transition-all border-slate-200 dark:border-slate-800 ${
                        statusFilter === "all" ? "ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">إجمالي الطلبات</p>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{requests.length}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                            <Store className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setStatusFilter("pending")}
                    className={`cursor-pointer transition-all border-slate-200 dark:border-slate-800 ${
                        statusFilter === "pending" ? "ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">قيد المراجعة</p>
                            <h3 className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setStatusFilter("approved")}
                    className={`cursor-pointer transition-all border-slate-200 dark:border-slate-800 ${
                        statusFilter === "approved" ? "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">تم القبول</p>
                            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{approvedCount}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setStatusFilter("rejected")}
                    className={`cursor-pointer transition-all border-slate-200 dark:border-slate-800 ${
                        statusFilter === "rejected" ? "ring-2 ring-red-500 bg-red-50/50 dark:bg-red-950/20" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">مرفوضة</p>
                            <h3 className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{rejectedCount}</h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                            <XCircle className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Search Bar */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="بحث بالاسم، الهاتف، البريد، أو التصنيف..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
                        />
                    </div>
                    
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <Button
                            size="sm"
                            variant={statusFilter === "all" ? "default" : "outline"}
                            onClick={() => setStatusFilter("all")}
                            className="rounded-lg text-xs"
                        >
                            الكل ({requests.length})
                        </Button>
                        <Button
                            size="sm"
                            variant={statusFilter === "pending" ? "default" : "outline"}
                            onClick={() => setStatusFilter("pending")}
                            className="rounded-lg text-xs"
                        >
                            معلقة ({pendingCount})
                        </Button>
                        <Button
                            size="sm"
                            variant={statusFilter === "approved" ? "default" : "outline"}
                            onClick={() => setStatusFilter("approved")}
                            className="rounded-lg text-xs"
                        >
                            مقبولة ({approvedCount})
                        </Button>
                        <Button
                            size="sm"
                            variant={statusFilter === "rejected" ? "default" : "outline"}
                            onClick={() => setStatusFilter("rejected")}
                            className="rounded-lg text-xs"
                        >
                            مرفوضة ({rejectedCount})
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Requests List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                    <p className="text-sm">جاري تحميل الطلبات...</p>
                </div>
            ) : filteredRequests.length === 0 ? (
                <Card className="border-slate-200 dark:border-slate-800 text-center p-12">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">لا توجد طلبات تطابق هذا البحث</h3>
                    <p className="text-sm text-slate-500 mt-1">جرب تغيير حالة الفلترة أو مسح كلمات البحث</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRequests.map((req) => {
                        const isPending = req.status === "pending" || !req.status;
                        const isApproved = req.status === "approved";
                        const isRejected = req.status === "rejected";

                        return (
                            <Card
                                key={req.id}
                                className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                {req.name ? req.name[0] : "P"}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                                                    {req.name}
                                                </h4>
                                                <Badge variant="outline" className="mt-1 text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30">
                                                    {req.category || "خدمة عامة"}
                                                </Badge>
                                            </div>
                                        </div>

                                        {isPending && (
                                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs">
                                                قيد الانتظار
                                            </Badge>
                                        )}
                                        {isApproved && (
                                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs">
                                                تم القبول
                                            </Badge>
                                        )}
                                        {isRejected && (
                                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800 text-xs">
                                                مرفوض
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span dir="ltr" className="font-mono font-medium">{req.phone || "بدون هاتف"}</span>
                                        </div>
                                        {req.email && (
                                            <div className="flex items-center gap-2 truncate">
                                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{req.email}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate">{req.location || "لم يحدد الموقع"}</span>
                                        </div>
                                        {(req.created_at || req.date) && (
                                            <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                                <Calendar className="w-3 h-3" />
                                                <span>{new Date(req.created_at || req.date || "").toLocaleDateString("ar-EG")}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setSelectedReq(req);
                                                setModalOpen(true);
                                            }}
                                            className="text-xs flex-1 gap-1 text-slate-600 dark:text-slate-300"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            التفاصيل
                                        </Button>

                                        {isPending && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(req)}
                                                    disabled={actionLoading === req.id}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-1 shadow-sm"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    قبول
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReject(req)}
                                                    disabled={actionLoading === req.id}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50 text-xs gap-1"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    رفض
                                                </Button>
                                            </>
                                        )}

                                        {isApproved && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleReject(req)}
                                                disabled={actionLoading === req.id}
                                                className="text-red-600 text-xs hover:bg-red-50 border-red-200 dark:border-red-900/50"
                                            >
                                                إلغاء التفعيل
                                            </Button>
                                        )}

                                        {isRejected && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleApprove(req)}
                                                disabled={actionLoading === req.id}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                            >
                                                إعادة قبول
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Details Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Store className="w-5 h-5 text-indigo-600" />
                            بيانات طلب الانضمام
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            مراجعة البيانات الكاملة للطلب قبل اتخاذ القرار
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReq && (
                        <div className="space-y-4 py-3">
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div>
                                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{selectedReq.name}</h4>
                                    <p className="text-xs text-slate-500">{selectedReq.category}</p>
                                </div>
                                <Badge className={
                                    selectedReq.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                                    selectedReq.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                                }>
                                    {selectedReq.status === "approved" ? "مقبول" : selectedReq.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                                </Badge>
                            </div>

                            <div className="space-y-2.5 text-sm">
                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">رقم الهاتف:</span>
                                    <span dir="ltr" className="font-mono font-medium text-slate-800 dark:text-slate-200">{selectedReq.phone}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">البريد الإلكتروني:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedReq.email || "غير متوفر"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">المنطقة / العنوان:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedReq.location || "غير محدد"}</span>
                                </div>
                                {selectedReq.details && (
                                    <div className="pt-2">
                                        <span className="text-slate-500 block mb-1">تفاصيل إضافية:</span>
                                        <p className="text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                                            {selectedReq.details}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        {selectedReq && (selectedReq.status === "pending" || !selectedReq.status) ? (
                            <div className="flex w-full gap-2">
                                <Button
                                    onClick={() => {
                                        setModalOpen(false);
                                        handleApprove(selectedReq);
                                    }}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircle2 className="w-4 h-4 ml-1.5" />
                                    قبول وتفعيل
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setModalOpen(false);
                                        handleReject(selectedReq);
                                    }}
                                    className="flex-1 text-red-600 hover:bg-red-50 border-red-200"
                                >
                                    <XCircle className="w-4 h-4 ml-1.5" />
                                    رفض الطلب
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setModalOpen(false)} className="w-full">
                                إغلاق
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
