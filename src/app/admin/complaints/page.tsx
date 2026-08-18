"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Search, CheckCircle2, Clock, AlertTriangle, User, Send, Filter, Loader2, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";
import { apiCall } from "@/lib/api";

interface Ticket {
    id: string;
    userName: string;
    userPhone: string;
    userType: "customer" | "provider" | "courier";
    subject: string;
    category: "order_issue" | "payment_issue" | "behavior_issue" | "technical";
    priority: "high" | "medium" | "low";
    status: "open" | "in_progress" | "resolved";
    createdAt: string;
    details: string;
    orderId?: string;
    responses: { sender: string; text: string; date: string }[];
}

export default function AdminComplaintsPage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState("");
    const [loading, setLoading] = useState(false);

    const [tickets, setTickets] = useState<Ticket[]>([
        {
            id: "TKT-901",
            userName: "محمود سعيد",
            userPhone: "01012345678",
            userType: "customer",
            subject: "تأخير في استلام طلب الطعام #1084",
            category: "order_issue",
            priority: "high",
            status: "open",
            createdAt: "2026-08-18 22:30",
            details: "قمت بطلب وجبة منذ 45 دقيقة ولم يقم المندوب بالحركة حتى الآن، يرجى المتابعة فوراً.",
            orderId: "1084",
            responses: [
                { sender: "العميل", text: "قمت بطلب وجبة منذ 45 دقيقة ولم يقم المندوب بالحركة حتى الآن.", date: "22:30" }
            ]
        },
        {
            id: "TKT-902",
            userName: "مطعم ابن الشام",
            userPhone: "01234567890",
            userType: "provider",
            subject: "مشكلة في احتساب عمولة طلب التوصيل #1072",
            category: "payment_issue",
            priority: "medium",
            status: "in_progress",
            createdAt: "2026-08-18 19:15",
            details: "تم الخصم بنسبة 15% بدلاً من 12% المتفق عليها في عقد الانضمام.",
            orderId: "1072",
            responses: [
                { sender: "المتجر", text: "تم الخصم بنسبة 15% بدلاً من 12%.", date: "19:15" },
                { sender: "الدعم الفني", text: "جاري مراجعة فاتورة الطلب والتسوية المالية.", date: "19:40" }
            ]
        },
        {
            id: "TKT-903",
            userName: "أحمد المندوب",
            userPhone: "01122334455",
            userType: "courier",
            subject: "العميل لا يجيب على الاتصال لاستلام الشحنة",
            category: "behavior_issue",
            priority: "low",
            status: "resolved",
            createdAt: "2026-08-17 14:10",
            details: "وصلت للعنوان المحدد والعميل مغلق هاتفه منذ 15 دقيقة.",
            orderId: "1065",
            responses: [
                { sender: "المندوب", text: "وصلت للعنوان والعميل لا يجيب.", date: "14:10" },
                { sender: "الدعم الفني", text: "تم التواصل مع العميل وإلغاء الطلب مع تعويض المندوب برسوم التوصيل.", date: "14:25" }
            ]
        }
    ]);

    const filteredTickets = tickets.filter(t => {
        const matchesSearch = t.userName.includes(searchTerm) || t.subject.includes(searchTerm) || t.id.includes(searchTerm);
        const matchesStatus = !statusFilter || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleSendReply = () => {
        if (!selectedTicket || !replyText.trim()) return;

        const newResponse = {
            sender: "مسؤول النظام",
            text: replyText,
            date: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };

        const updated = tickets.map(t => {
            if (t.id === selectedTicket.id) {
                return {
                    ...t,
                    status: "in_progress" as const,
                    responses: [...t.responses, newResponse]
                };
            }
            return t;
        });

        setTickets(updated);
        setSelectedTicket({
            ...selectedTicket,
            status: "in_progress",
            responses: [...selectedTicket.responses, newResponse]
        });
        setReplyText("");
        toast("تم إرسال الرد وتحديث حالة الشكوى ✅", "success");
    };

    const handleResolve = (id: string) => {
        setTickets(tickets.map(t => t.id === id ? { ...t, status: "resolved" } : t));
        if (selectedTicket && selectedTicket.id === id) {
            setSelectedTicket({ ...selectedTicket, status: "resolved" });
        }
        toast("تم إغلاق وحل الشكوى بنجاح 🎉", "success");
    };

    return (
        <div className="space-y-6 font-cairo" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">📩 مركز الشكاوى والدعم الفني</h1>
                    <p className="text-slate-500 text-sm mt-1">استقبال وحل بلاغات العملاء، مقدمي الخدمات، والمناديب ومتابعتها</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">شكاوى مفتوحة (تحتاج معالجة)</p>
                            <p className="text-2xl font-black text-amber-500 mt-1 font-mono">{tickets.filter(t => t.status === "open").length}</p>
                        </div>
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                            <Clock className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">قيد المتابعة والتواصل</p>
                            <p className="text-2xl font-black text-indigo-500 mt-1 font-mono">{tickets.filter(t => t.status === "in_progress").length}</p>
                        </div>
                        <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">تم حلها وإغلاقها</p>
                            <p className="text-2xl font-black text-emerald-500 mt-1 font-mono">{tickets.filter(t => t.status === "resolved").length}</p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tickets List */}
                <Card className="lg:col-span-1 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[650px]">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="بحث باسم صاحب البلاغ أو العنوان..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pr-9 h-9 text-xs rounded-xl"
                                />
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setStatusFilter("")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!statusFilter ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
                                >
                                    الكل
                                </button>
                                <button
                                    onClick={() => setStatusFilter("open")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === "open" ? "bg-amber-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
                                >
                                    مفتوحة
                                </button>
                                <button
                                    onClick={() => setStatusFilter("resolved")}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === "resolved" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
                                >
                                    مغلقة
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTickets.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => setSelectedTicket(t)}
                                className={`p-3.5 rounded-xl cursor-pointer transition-all space-y-2 ${selectedTicket?.id === t.id ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{t.id}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        t.status === "open" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                        t.status === "in_progress" ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20" :
                                        "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    }`}>
                                        {t.status === "open" && "مفتوحة"}
                                        {t.status === "in_progress" && "جاري المتابعة"}
                                        {t.status === "resolved" && "تم الحل"}
                                    </span>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{t.subject}</h4>
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>{t.userName} ({t.userType === "customer" ? "عميل" : t.userType === "provider" ? "متجر" : "مندوب"})</span>
                                    <span className="font-mono">{t.createdAt}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Ticket Details & Reply Panel */}
                <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[650px]">
                    {selectedTicket ? (
                        <>
                            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{selectedTicket.id}</span>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        صاحب البلاغ: <strong>{selectedTicket.userName}</strong> ({selectedTicket.userPhone}) • رقم الطلب: <strong>#{selectedTicket.orderId || "عام"}</strong>
                                    </p>
                                </div>
                                {selectedTicket.status !== "resolved" && (
                                    <Button
                                        onClick={() => handleResolve(selectedTicket.id)}
                                        className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        إغلاق وحل البلاغ
                                    </Button>
                                )}
                            </CardHeader>

                            <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
                                {selectedTicket.responses.map((resp, i) => (
                                    <div
                                        key={i}
                                        className={`p-4 rounded-2xl max-w-[85%] space-y-1 ${
                                            resp.sender === "مسؤول النظام" || resp.sender === "الدعم الفني"
                                                ? "mr-auto bg-indigo-600 text-white rounded-br-none"
                                                : "ml-auto bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs font-bold opacity-80 gap-4">
                                            <span>{resp.sender}</span>
                                            <span className="font-mono text-[10px]">{resp.date}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{resp.text}</p>
                                    </div>
                                ))}
                            </CardContent>

                            {selectedTicket.status !== "resolved" && (
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                    <Input
                                        placeholder="اكتب رد الدعم الفني والحل المباشر للمستخدم..."
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleSendReply()}
                                        className="rounded-xl flex-1 text-sm"
                                    />
                                    <Button onClick={handleSendReply} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                        <Send className="w-4 h-4" />
                                        إرسال الرد
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                            <MessageSquare className="w-12 h-12 opacity-30" />
                            <p className="text-sm">اختر شكوى من القائمة الجانبية لعرض التاصيل والرد المباشر</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
