"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Package, Search, Plus, RefreshCw, Pencil, Trash2,
    Store, DollarSign, Tag, CheckCircle2, XCircle, ShoppingBag
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { apiCall } from "@/lib/api";

interface ProductItem {
    id: number;
    name: string;
    description?: string;
    price: number;
    provider_name?: string;
    category?: string;
    is_available?: boolean;
}

const SAMPLE_PRODUCTS: ProductItem[] = [
    { id: 1, name: "كشري وسط", description: "طبق كشري مع دقة وصلصة", price: 35, provider_name: "مطعم البركة", category: "مطاعم", is_available: true },
    { id: 2, name: "طاجن مكرونة بشاميل", description: "طاجن فرن باللحمة المفرومة", price: 55, provider_name: "مطعم البركة", category: "مطاعم", is_available: true },
    { id: 3, name: "صيانة وتصليح حنفية", description: "تغيير قلب وصيانة تسريب مياه", price: 120, provider_name: "سباكة حديثة", category: "صيانة", is_available: true },
    { id: 4, name: "تأسيس شبكة مياه كاملة", description: "تأسيس حمام ومطبخ للشقق", price: 850, provider_name: "سباكة حديثة", category: "صيانة", is_available: true },
    { id: 5, name: "شحن رصيد 100 ج.م فودافون", description: "كارت شحن فوري مع التوصيل", price: 105, provider_name: "قريبلك - خدمات إضافية", category: "خدمات شحن", is_available: true },
    { id: 6, name: "غسيل سيارة شامل + تلميع", description: "غسيل خارجي وداخلي بالبخار", price: 150, provider_name: "محمود لخدمات السيارات", category: "خدمات سيارات", is_available: true },
];

export default function AdminProductsPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [products, setProducts] = useState<ProductItem[]>(SAMPLE_PRODUCTS);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ProductItem | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        provider_name: "",
        category: "مطاعم",
        is_available: true,
    });

    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiCall<any>("/services");
            const list = Array.isArray(res) ? res : res?.services || res?.data || [];
            if (list.length > 0) setProducts(list);
        } catch {
            // Keep current sample list
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.price) {
            toast("يرجى إدخال اسم وسعر الخدمة/المنتج", "error");
            return;
        }

        if (editingItem) {
            setProducts(prev => prev.map(p => p.id === editingItem.id ? {
                ...p,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                provider_name: formData.provider_name || p.provider_name,
                category: formData.category,
                is_available: formData.is_available,
            } : p));
            toast("تم تحديث المنتج بنجاح ✅", "success");
        } else {
            const newItem: ProductItem = {
                id: Date.now(),
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                provider_name: formData.provider_name || "قريبلك",
                category: formData.category,
                is_available: formData.is_available,
            };
            setProducts(prev => [newItem, ...prev]);
            toast("تم إضافة المنتج بنجاح 🎉", "success");
        }

        setModalOpen(false);
        setEditingItem(null);
    };

    const handleDelete = async (item: ProductItem) => {
        const confirmed = await confirm({
            title: "حذف المنتج / الخدمة",
            message: `هل أنت متأكد من حذف "${item.name}"؟`,
            confirmText: "نعم، حذف",
            cancelText: "إلغاء",
            type: "danger",
        });

        if (confirmed) {
            setProducts(prev => prev.filter(p => p.id !== item.id));
            toast("تم حذف العنصر", "info");
        }
    };

    const filtered = products.filter(p =>
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.provider_name && p.provider_name.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Package className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        كتالوج المنتجات والخدمات المعروضة
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        إدارة وتعديل المنتجات وقوائم الخدمات المتاحة للطلب في منصة قريبلك
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={loadProducts}
                        disabled={loading}
                        className="gap-2 border-slate-200 dark:border-slate-800"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        تحديث
                    </Button>
                    <Button
                        onClick={() => {
                            setEditingItem(null);
                            setFormData({ name: "", description: "", price: "", provider_name: "", category: "مطاعم", is_available: true });
                            setModalOpen(true);
                        }}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة منتج/خدمة
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="بحث باسم المنتج، المتجر، أو التصنيف..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">#</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الاسم والوصف</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">مقدم الخدمة / المتجر</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">القسم</th>
                                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">السعر</th>
                                <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">الحالة</th>
                                <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">#{item.id}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                                        {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{item.description}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">
                                        {item.provider_name || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className="text-xs">{item.category || "عام"}</Badge>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                                        {item.price} ج.م
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge className={item.is_available !== false ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-red-100 text-red-800 text-[10px]"}>
                                            {item.is_available !== false ? "متوفر" : "غير متاح"}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setFormData({
                                                        name: item.name,
                                                        description: item.description || "",
                                                        price: String(item.price),
                                                        provider_name: item.provider_name || "",
                                                        category: item.category || "مطاعم",
                                                        is_available: item.is_available !== false,
                                                    });
                                                    setModalOpen(true);
                                                }}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => handleDelete(item)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {editingItem ? "تعديل المنتج / الخدمة" : "إضافة منتج أو خدمة جديدة"}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">اسم المنتج / الخدمة *</label>
                            <Input
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">السعر (ج.م) *</label>
                            <Input
                                required
                                type="number"
                                step="0.5"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">مقدم الخدمة / المتجر</label>
                            <Input
                                value={formData.provider_name}
                                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">الوصف</label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                حفظ
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
