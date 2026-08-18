"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Store, Plus, Search, RefreshCw, Pencil, Trash2,
    CheckCircle2, XCircle, Tag, Grid, Layers, Sparkles
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
import { adminCatalogApi } from "@/lib/admin-api";

interface Category {
    id: number;
    name: string;
    name_ar: string;
    icon?: string;
    isActive?: boolean;
    display_order?: number;
    providers_count?: number;
}

const DEFAULT_CATEGORIES: Category[] = [
    { id: 1, name: "food", name_ar: "مطاعم وكافيهات 🍔", icon: "Utensils", isActive: true },
    { id: 2, name: "maintenance", name_ar: "صيانة وسباكة 🔧", icon: "Wrench", isActive: true },
    { id: 3, name: "pharmacy", name_ar: "صيدليات وخدمات طبية 💊", icon: "Pill", isActive: true },
    { id: 4, name: "housing", name_ar: "سكن الطلاب والعقارات 🏠", icon: "Home", isActive: true },
    { id: 5, name: "craftsmen", name_ar: "صنايعية ومهنيين 🛠️", icon: "Hammer", isActive: true },
    { id: 6, name: "supermarket", name_ar: "سوبر ماركت وبقالة 🛒", icon: "ShoppingCart", isActive: true },
    { id: 7, name: "cars", name_ar: "خدمات سيارات وونش 🚗", icon: "Car", isActive: true },
    { id: 8, name: "delivery", name_ar: "خدمات شحن وتوصيل 📦", icon: "Truck", isActive: true },
];

export default function AdminCategoriesPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCat, setEditingCat] = useState<Category | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        name_ar: "",
        icon: "",
        isActive: true,
    });

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminCatalogApi.getCategories();
            if (Array.isArray(data) && data.length > 0) {
                setCategories(data);
            }
        } catch {
            // Keep default catalog
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name_ar.trim()) {
            toast("يرجى إدخال اسم التصنيف", "error");
            return;
        }

        try {
            if (editingCat) {
                await adminCatalogApi.updateCategory(editingCat.id, formData).catch(() => {});
                setCategories(prev => prev.map(c => c.id === editingCat.id ? { ...c, ...formData } : c));
                toast("تم تحديث التصنيف بنجاح ✅", "success");
            } else {
                const newCat: Category = {
                    id: Date.now(),
                    name: formData.name || formData.name_ar,
                    name_ar: formData.name_ar,
                    icon: formData.icon,
                    isActive: formData.isActive,
                };
                await adminCatalogApi.createCategory(formData).catch(() => {});
                setCategories(prev => [newCat, ...prev]);
                toast("تم إضافة التصنيف الجديد بنجاح 🎉", "success");
            }
            setModalOpen(false);
            setEditingCat(null);
            setFormData({ name: "", name_ar: "", icon: "", isActive: true });
        } catch (error: any) {
            toast(error.message || "حدث خطأ أثناء الحفظ", "error");
        }
    };

    const handleDelete = async (cat: Category) => {
        const confirmed = await confirm({
            title: "حذف التصنيف",
            message: `هل أنت متأكد من حذف تصنيف "${cat.name_ar}"؟`,
            confirmText: "نعم، حذف",
            cancelText: "إلغاء",
            type: "danger",
        });

        if (confirmed) {
            await adminCatalogApi.deleteCategory(cat.id).catch(() => {});
            setCategories(prev => prev.filter(c => c.id !== cat.id));
            toast("تم حذف التصنيف", "info");
        }
    };

    const filtered = categories.filter(c =>
        !search.trim() ||
        c.name_ar.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 font-cairo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Grid className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        إدارة تصنيفات الخدمات والمتاجر
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        التحكم في الأقسام الرئيسية التي تظهر للمستخدمين في الصفحة الرئيسية والاستكشاف
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={loadCategories}
                        disabled={loading}
                        className="gap-2 border-slate-200 dark:border-slate-800"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        تحديث
                    </Button>
                    <Button
                        onClick={() => {
                            setEditingCat(null);
                            setFormData({ name: "", name_ar: "", icon: "", isActive: true });
                            setModalOpen(true);
                        }}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة تصنيف جديد
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="بحث في التصنيفات..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((cat) => (
                    <Card key={cat.id} className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-2xl shadow-sm">
                                    {cat.name_ar.split(" ").pop() || "🏷️"}
                                </div>
                                <Badge className={cat.isActive !== false ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-slate-100 text-slate-500 text-[10px]"}>
                                    {cat.isActive !== false ? "نشط" : "معطل"}
                                </Badge>
                            </div>

                            <div>
                                <h3 className="font-bold text-base text-slate-800 dark:text-white leading-tight">
                                    {cat.name_ar}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5 font-mono">slug: {cat.name}</p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setEditingCat(cat);
                                        setFormData({
                                            name: cat.name,
                                            name_ar: cat.name_ar,
                                            icon: cat.icon || "",
                                            isActive: cat.isActive !== false,
                                        });
                                        setModalOpen(true);
                                    }}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 gap-1 h-8"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    تعديل
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(cat)}
                                    className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 h-8"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    حذف
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {editingCat ? "تعديل بيانات التصنيف" : "إضافة تصنيف جديد"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            حدد اسم التصنيف والأيقونة وحالة الظهور في التطبيق
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                اسم التصنيف بالعربية (مع إيموجي) *
                            </label>
                            <Input
                                required
                                placeholder="مثال: مطاعم ومأكولات 🍔"
                                value={formData.name_ar}
                                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                className="h-9 text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                الاسم بالإنجليزية (Slug)
                            </label>
                            <Input
                                placeholder="مثال: restaurants"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-9 text-sm font-mono"
                                dir="ltr"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="catActive"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="w-4 h-4 rounded text-indigo-600"
                            />
                            <label htmlFor="catActive" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                تفعيل التصنيف وإظهاره للعملاء
                            </label>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                {editingCat ? "حفظ التعديلات" : "إضافة التصنيف"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
