"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, Search, RefreshCw, Eye, Pencil, Ban, CheckCircle, XCircle,
    Loader2, Phone, Mail, Calendar, ShoppingBag, ChevronLeft, ChevronRight,
    Shield, User, Store, Truck, UserCog, Key,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminUsersApi } from "@/lib/admin-api";

// ========== Types ==========
interface UserProfile {
    id: number;
    name: string;
    name_ar?: string;
    email: string;
    phone?: string;
    user_type: string;
    is_banned?: boolean;
    is_online?: boolean;
    is_available?: boolean;
    created_at?: string;
    total_orders?: number;
    total_bookings?: number;
    rating?: number;
}

// ========== Tabs Config ==========
const USER_TABS = [
    { key: "customer", label: "العملاء", icon: User, color: "text-blue-600" },
    { key: "provider", label: "مقدمي الخدمات", icon: Store, color: "text-purple-600" },
    { key: "partner_courier", label: "المناديب", icon: Truck, color: "text-orange-600" },
    { key: "admin", label: "المسؤولين", icon: UserCog, color: "text-red-600" },
];

export default function UsersCustomersPage() {
    const [activeTab, setActiveTab] = useState("customer");
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    // Modal state
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<"view" | "edit" | "password">("view");
    const [editData, setEditData] = useState({ name: "", phone: "", email: "" });
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ===== Fetch Users =====
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminUsersApi.getAll({
                type: activeTab,
                page,
                limit: 25,
                search: search || undefined,
            });
            setUsers(data.users || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalUsers(data.pagination?.total || 0);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, search]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Reset page when tab changes
    useEffect(() => {
        setPage(1);
        setSearch("");
    }, [activeTab]);

    // ===== Ban/Unban =====
    const toggleBan = async (user: UserProfile) => {
        const newBanState = !user.is_banned;
        const reason = newBanState ? prompt("سبب الحظر:") : undefined;
        if (newBanState && !reason) return;
        try {
            await adminUsersApi.toggleBan(user.id, newBanState, reason || undefined);
            fetchUsers();
        } catch (error) {
            console.error("Ban toggle failed:", error);
        }
    };

    // ===== Open User Modal =====
    const openUserModal = (user: UserProfile) => {
        setSelectedUser(user);
        setEditData({ name: user.name || "", phone: user.phone || "", email: user.email || "" });
        setNewPassword("");
        setModalTab("view");
        setMessage(null);
        setModalOpen(true);
    };

    // ===== Save Edit =====
    const handleSaveEdit = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setMessage(null);
        try {
            await adminUsersApi.editProfile(selectedUser.id, editData);
            setMessage({ type: "success", text: "تم تحديث البيانات بنجاح ✅" });
            fetchUsers();
        } catch (error: unknown) {
            setMessage({ type: "error", text: (error as Error).message || "فشل في التحديث" });
        } finally {
            setSaving(false);
        }
    };

    // ===== Reset Password =====
    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            await adminUsersApi.resetPassword(selectedUser.id, newPassword);
            setMessage({ type: "success", text: "تم إعادة تعيين كلمة المرور ✅" });
            setNewPassword("");
        } catch (error: unknown) {
            setMessage({ type: "error", text: (error as Error).message || "فشل في إعادة التعيين" });
        } finally {
            setSaving(false);
        }
    };

    // ===== Type Label =====
    const typeLabel = (type: string) => {
        switch (type) {
            case "customer": return "عميل";
            case "provider": return "مقدم خدمة";
            case "partner_courier": return "مندوب";
            case "admin": return "مسؤول";
            case "owner": return "مالك النظام";
            default: return type;
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">👥 إدارة المستخدمين</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">عرض وتعديل وحظر جميع المستخدمين في النظام</p>
            </div>

            {/* User Type Tabs */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                {USER_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.key
                                ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.key ? "text-indigo-600" : ""}`} />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Search & Filters */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="بحث بالاسم، البريد، أو الهاتف..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pr-10 h-9 text-sm rounded-lg"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            تحديث
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">#</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">الاسم</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">البريد / الهاتف</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">الحالة</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">التسجيل</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                                        <p className="text-sm text-slate-500">جاري التحميل...</p>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-sm text-slate-500">لا يوجد مستخدمين</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                        onClick={() => openUserModal(user)}
                                    >
                                        <td className="px-3 py-2.5">
                                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">#{user.id}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                    user.is_banned ? "bg-red-100 dark:bg-red-900/30" : "bg-indigo-100 dark:bg-indigo-900/30"
                                                }`}>
                                                    <span className="text-sm font-bold">{(user.name || "?")[0]}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-800 dark:text-white">{user.name_ar || user.name}</p>
                                                    <p className="text-[10px] text-slate-400">{typeLabel(user.user_type)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-xs text-slate-600 dark:text-slate-300">{user.email || "—"}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{user.phone || ""}</p>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {user.is_banned ? (
                                                <Badge variant="destructive" className="text-[10px]">محظور</Badge>
                                            ) : user.is_online ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-semibold">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> متصل
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">غير متصل</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-xs text-slate-500">
                                                {user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString("ar-EG", { dateStyle: "medium" })
                                                    : "—"}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openUserModal(user)}
                                                    className="p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                                    title="عرض"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { openUserModal(user); setTimeout(() => setModalTab("edit"), 50); }}
                                                    className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                                    title="تعديل"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleBan(user)}
                                                    className={`p-1.5 rounded-md transition-colors ${
                                                        user.is_banned
                                                            ? "hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                                                            : "hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                                                    }`}
                                                    title={user.is_banned ? "إلغاء الحظر" : "حظر"}
                                                >
                                                    {user.is_banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500">صفحة {page} من {totalPages} — {totalUsers} مستخدم</p>
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

            {/* ======================== User Detail Modal ======================== */}
            <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0" dir="rtl">
                    {selectedUser && (
                        <>
                            {/* Header */}
                            <div className="px-6 pt-6 pb-3 border-b border-slate-200 dark:border-slate-800">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-3 text-lg">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${
                                            selectedUser.is_banned ? "bg-red-500" : "bg-indigo-500"
                                        }`}>
                                            {(selectedUser.name || "?")[0]}
                                        </div>
                                        <div>
                                            <span className="font-cairo">{selectedUser.name_ar || selectedUser.name}</span>
                                            {selectedUser.is_banned && (
                                                <Badge variant="destructive" className="mr-2 text-[10px]">محظور</Badge>
                                            )}
                                            <p className="text-xs text-slate-500 font-normal mt-0.5">
                                                {typeLabel(selectedUser.user_type)} — #{selectedUser.id}
                                            </p>
                                        </div>
                                    </DialogTitle>
                                </DialogHeader>

                                {/* Tabs */}
                                <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                    {[
                                        { key: "view" as const, label: "البيانات", icon: Eye },
                                        { key: "edit" as const, label: "تعديل", icon: Pencil },
                                        { key: "password" as const, label: "كلمة المرور", icon: Key },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setModalTab(tab.key)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                modalTab === tab.key
                                                    ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                                                    : "text-slate-500 dark:text-slate-400"
                                            }`}
                                        >
                                            <tab.icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                                {message && (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                                        message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                                    }`}>
                                        {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                        {message.text}
                                    </div>
                                )}

                                {modalTab === "view" && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <InfoField icon={Mail} label="البريد" value={selectedUser.email} />
                                            <InfoField icon={Phone} label="الهاتف" value={selectedUser.phone || "—"} />
                                            <InfoField icon={Calendar} label="تاريخ التسجيل" value={
                                                selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("ar-EG") : "—"
                                            } />
                                            <InfoField icon={ShoppingBag} label="عدد الطلبات" value={String(selectedUser.total_orders || selectedUser.total_bookings || 0)} />
                                        </div>

                                        {/* Quick Ban/Unban */}
                                        <Button
                                            onClick={() => toggleBan(selectedUser)}
                                            variant={selectedUser.is_banned ? "outline" : "destructive"}
                                            className="w-full gap-2 mt-4"
                                        >
                                            {selectedUser.is_banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                            {selectedUser.is_banned ? "إلغاء الحظر" : "حظر المستخدم"}
                                        </Button>
                                    </div>
                                )}

                                {modalTab === "edit" && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">الاسم</label>
                                            <Input value={editData.name} onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">البريد الإلكتروني</label>
                                            <Input value={editData.email} onChange={(e) => setEditData(d => ({ ...d, email: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">الهاتف</label>
                                            <Input value={editData.phone} onChange={(e) => setEditData(d => ({ ...d, phone: e.target.value }))} />
                                        </div>
                                        <Button onClick={handleSaveEdit} disabled={saving} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                                            حفظ التعديلات
                                        </Button>
                                    </div>
                                )}

                                {modalTab === "password" && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                                            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                                            <p className="text-xs text-amber-700">سيتم تغيير كلمة المرور فوراً دون إرسال إشعار للمستخدم.</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">كلمة المرور الجديدة</label>
                                            <Input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="أدخل كلمة المرور الجديدة..."
                                            />
                                        </div>
                                        <Button onClick={handleResetPassword} disabled={saving || !newPassword.trim()} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                            إعادة تعيين كلمة المرور
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ===== Info Field Component =====
function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-white">{value}</p>
        </div>
    );
}
