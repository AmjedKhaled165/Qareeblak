"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, Search, RefreshCw, Eye, Pencil, Ban, CheckCircle, XCircle,
    Loader2, Phone, Mail, Calendar, ShoppingBag, ChevronLeft, ChevronRight,
    Shield, User, Store, Truck, UserCog, Key, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminUsersApi } from "@/lib/admin-api";

export interface UserProfile {
    display_id?: string | number;
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

const USER_TABS = [
    { key: "customer", label: "العملاء", icon: User, color: "text-blue-600" },
    { key: "provider", label: "مقدمي الخدمات", icon: Store, color: "text-purple-600" },
    { key: "partner_courier", label: "المناديب", icon: Truck, color: "text-orange-600" },
    { key: "admin", label: "المسؤولين", icon: UserCog, color: "text-red-600" },
];

interface UserManagerProps {
    initialTab?: "customer" | "provider" | "partner_courier" | "admin";
    pageTitle?: string;
    pageSubtitle?: string;
    hideTabs?: boolean;
}

export default function UserManager({
    initialTab = "customer",
    pageTitle = "إدارة المستخدمين",
    pageSubtitle = "عرض وتعديل وحظر جميع المستخدمين في النظام",
    hideTabs = false,
}: UserManagerProps) {
    const [activeTab, setActiveTab] = useState<string>(initialTab);
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

    const openUserModal = (user: UserProfile) => {
        setSelectedUser(user);
        setEditData({ name: user.name || "", phone: user.phone || "", email: user.email || "" });
        setNewPassword("");
        setModalTab("view");
        setMessage(null);
        setModalOpen(true);
    };

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
        <div className="space-y-4 max-w-7xl mx-auto font-cairo">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    {pageTitle}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{pageSubtitle}</p>
            </div>

            {/* User Type Tabs */}
            {!hideTabs && (
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
                            {(() => {
                                const TabIcon = tab.icon as any;
                                return <TabIcon className={`w-4 h-4 ${activeTab === tab.key ? "text-indigo-600" : ""}`} />;
                            })()}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            )}

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
                                className="pr-10 h-9 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5 border-slate-200 dark:border-slate-800">
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
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">#</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الاسم</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">البريد / الهاتف</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الحالة</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">التسجيل</th>
                                <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">إجراءات</th>
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
                                        <p className="text-sm text-slate-500">لا يوجد مستخدمين مسجلين</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                        onClick={() => openUserModal(user)}
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">#{user.display_id || user.id}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {user.name ? user.name[0] : "U"}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-tight">{user.name}</p>
                                                    {user.name_ar && <p className="text-[11px] text-slate-400">{user.name_ar}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5 text-xs">
                                                {user.email && (
                                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[180px]">{user.email}</span>
                                                    </div>
                                                )}
                                                {user.phone && (
                                                    <div className="flex items-center gap-1.5 text-slate-500">
                                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span dir="ltr" className="font-mono">{user.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                {user.is_banned ? (
                                                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-[10px]">
                                                        محظور
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                                                        نشط
                                                    </Badge>
                                                )}
                                                {user.is_available !== undefined && (
                                                    <span className={`text-[10px] ${user.is_available ? "text-emerald-600" : "text-slate-400"}`}>
                                                        {user.is_available ? "• متاح للعمل" : "• غير متاح"}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString("ar-EG") : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => openUserModal(user)}
                                                    title="عرض وتعديل"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className={`h-7 w-7 p-0 ${user.is_banned ? "text-emerald-600 hover:text-emerald-700" : "text-red-600 hover:text-red-700"}`}
                                                    onClick={() => toggleBan(user)}
                                                    title={user.is_banned ? "إلغاء الحظر" : "حظر المستخدم"}
                                                >
                                                    <Ban className="w-3.5 h-3.5" />
                                                </Button>
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
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            صفحة {page} من {totalPages} (إجمالي {totalUsers})
                        </span>
                        <div className="flex gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="h-8 px-2 text-xs"
                            >
                                السابق
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="h-8 px-2 text-xs"
                            >
                                التالي
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* User Details / Edit Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-600" />
                            بيانات المستخدم #{selectedUser?.display_id || selectedUser?.id}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Modal Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setModalTab("view")}
                            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                                modalTab === "view"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            نظرة عامة
                        </button>
                        <button
                            onClick={() => setModalTab("edit")}
                            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                                modalTab === "edit"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            تعديل البيانات
                        </button>
                        <button
                            onClick={() => setModalTab("password")}
                            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                                modalTab === "password"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            كلمة المرور
                        </button>
                    </div>

                    {message && (
                        <div
                            className={`p-2.5 rounded-lg text-xs font-medium ${
                                message.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {selectedUser && modalTab === "view" && (
                        <div className="space-y-3 py-2 text-sm">
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">الاسم:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedUser.name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">البريد الإلكتروني:</span>
                                <span className="text-slate-800 dark:text-slate-200">{selectedUser.email || "—"}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">الهاتف:</span>
                                <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200">{selectedUser.phone || "—"}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">نوع الحساب:</span>
                                <Badge variant="outline">{typeLabel(selectedUser.user_type)}</Badge>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">الحالة:</span>
                                <Badge className={selectedUser.is_banned ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                                    {selectedUser.is_banned ? "محظور" : "نشط"}
                                </Badge>
                            </div>
                        </div>
                    )}

                    {selectedUser && modalTab === "edit" && (
                        <div className="space-y-3 py-2">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">الاسم</label>
                                <Input
                                    value={editData.name}
                                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">رقم الهاتف</label>
                                <Input
                                    value={editData.phone}
                                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                    className="h-9 text-sm"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">البريد الإلكتروني</label>
                                <Input
                                    value={editData.email}
                                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <Button onClick={handleSaveEdit} disabled={saving} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                            </Button>
                        </div>
                    )}

                    {selectedUser && modalTab === "password" && (
                        <div className="space-y-3 py-2">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">كلمة المرور الجديدة</label>
                                <PasswordInput
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="أدخل كلمة مرور جديدة..."
                                    className="h-9 text-sm"
                                />
                            </div>
                            <Button onClick={handleResetPassword} disabled={saving || !newPassword.trim()} className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white">
                                {saving ? "جاري التغيير..." : "إعادة تعيين كلمة المرور"}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
