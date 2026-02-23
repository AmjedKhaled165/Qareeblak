"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ScrollText, Search, RefreshCw, Calendar, Filter, Loader2,
    ChevronLeft, ChevronRight, AlertTriangle, Eye, Pencil, Trash2,
    Ban, CheckCircle, Shield, ArrowUpDown, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminAuditApi } from "@/lib/admin-api";

// ===== Types =====
interface AuditLog {
    id: number;
    admin_id: number;
    admin_name?: string;
    action: string;
    entity_type?: string;
    entity_id?: number;
    details?: string;
    old_value?: string;
    new_value?: string;
    ip_address?: string;
    created_at: string;
}

// ===== Action Badge Colors =====
const ACTION_COLORS: Record<string, string> = {
    force_edit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    force_status: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    reassign: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    ban: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    unban: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    edit_profile: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    reset_password: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    login: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
    force_edit: Pencil,
    force_status: AlertTriangle,
    reassign: ArrowUpDown,
    ban: Ban,
    unban: CheckCircle,
    edit_profile: Pencil,
    reset_password: Shield,
    delete: Trash2,
    create: CheckCircle,
    login: Eye,
};

const ACTION_LABELS: Record<string, string> = {
    force_edit: "تعديل قسري",
    force_status: "تغيير حالة",
    reassign: "إعادة تعيين",
    ban: "حظر مستخدم",
    unban: "إلغاء حظر",
    edit_profile: "تعديل بيانات",
    reset_password: "تغيير كلمة مرور",
    delete: "حذف",
    create: "إنشاء",
    login: "دخول",
};

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [expandedLog, setExpandedLog] = useState<number | null>(null);

    // ===== Fetch Logs =====
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminAuditApi.getLogs({
                page,
                limit: 30,
                action: actionFilter || undefined,
                userId: search ? String(parseInt(search) || '') || undefined : undefined,
                dateFrom: dateFilter || undefined,
            });
            setLogs(data.logs || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalLogs(data.pagination?.total || 0);
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, search, dateFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // ===== Time Ago =====
    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "الآن";
        if (mins < 60) return `منذ ${mins} دقيقة`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `منذ ${hours} ساعة`;
        const days = Math.floor(hours / 24);
        return `منذ ${days} يوم`;
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">📋 سجل المراجعة</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    من فعل ماذا ومتى — سجل كامل لجميع العمليات الإدارية
                </p>
            </div>

            {/* Filters */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="بحث برقم المستخدم (ID)..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pr-10 h-9 text-sm rounded-lg"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                title="تصفية حسب الإجراء"
                                value={actionFilter}
                                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                                className="h-9 pr-9 pl-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 appearance-none cursor-pointer"
                            >
                                <option value="">كل الإجراءات</option>
                                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                                className="h-9 pr-9 text-sm rounded-lg w-40"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1.5 h-9">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            تحديث
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Timeline */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-16 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                            <p className="text-sm text-slate-500">جاري تحميل السجلات...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-16 text-center">
                            <ScrollText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm text-slate-500">لا يوجد سجلات</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {logs.map((log) => {
                                const Icon = ACTION_ICONS[log.action] || Eye;
                                const colorClass = ACTION_COLORS[log.action] || "bg-slate-100 text-slate-700";
                                const label = ACTION_LABELS[log.action] || log.action;
                                const isExpanded = expandedLog === log.id;

                                return (
                                    <div
                                        key={log.id}
                                        className={`px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer ${
                                            isExpanded ? "bg-slate-50 dark:bg-slate-800/30" : ""
                                        }`}
                                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Action Icon */}
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>

                                            {/* Body */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className={`text-[10px] px-1.5 py-0.5 font-semibold ${colorClass} border-0`}>
                                                        {label}
                                                    </Badge>
                                                    {log.entity_type && (
                                                        <span className="text-xs text-slate-500">
                                                            {log.entity_type} #{log.entity_id}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-800 dark:text-white mt-1 leading-relaxed">
                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                                        {log.admin_name || `Admin #${log.admin_id}`}
                                                    </span>
                                                    {" — "}
                                                    {log.details || label}
                                                </p>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="mt-3 space-y-2 text-xs">
                                                        {log.old_value && (
                                                            <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                                                                <span className="font-semibold text-red-600">القيمة القديمة:</span>{" "}
                                                                <span className="text-red-700 dark:text-red-300 font-mono">{log.old_value}</span>
                                                            </div>
                                                        )}
                                                        {log.new_value && (
                                                            <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                                                                <span className="font-semibold text-green-600">القيمة الجديدة:</span>{" "}
                                                                <span className="text-green-700 dark:text-green-300 font-mono">{log.new_value}</span>
                                                            </div>
                                                        )}
                                                        {log.ip_address && (
                                                            <p className="text-slate-400 font-mono">IP: {log.ip_address}</p>
                                                        )}
                                                        <p className="text-slate-400">
                                                            {new Date(log.created_at).toLocaleString("ar-EG", {
                                                                dateStyle: "full",
                                                                timeStyle: "medium",
                                                            })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Time */}
                                            <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                                                <Clock className="w-3 h-3" />
                                                {timeAgo(log.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500">صفحة {page} من {totalPages} — {totalLogs} سجل</p>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
