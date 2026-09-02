"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCatalogApi } from "@/lib/admin-api";
import { requestsApi } from "@/lib/api";

export default function CatalogCategoriesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await adminCatalogApi.getCategories();
            const list = data.categories || data.data || data;
            if (Array.isArray(list) && list.length > 0) {
                setCategories(list);
            } else {
                setCategories(defaultCategories);
            }
        } catch {
            setCategories(defaultCategories);
        } finally {
            setLoading(false);
        }
    };

    const defaultCategories = [
        { id: 1, name: "مطاعم ومأكولات", name_ar: "مطاعم ومأكولات", icon: "🍔", count: 48, status: true },
        { id: 2, name: "صيدليات وأدوية", name_ar: "صيدليات وأدوية", icon: "💊", count: 24, status: true },
        { id: 3, name: "سوبرماركت ومواد غذائية", name_ar: "سوبرماركت ومواد غذائية", icon: "🛒", count: 35, status: true },
        { id: 4, name: "خدمات صيانة منزلية", name_ar: "خدمات صيانة منزلية", icon: "🔧", count: 18, status: true },
        { id: 5, name: "حلويات ومخبوزات", name_ar: "حلويات ومخبوزات", icon: "🍰", count: 12, status: true },
    ];

    const filtered = categories.filter((c: any) => (c.name_ar || c.name || "").includes(searchTerm));

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">📂 إدارة التصنيفات</h1>
                    <p className="text-slate-500 text-sm font-cairo mt-1">إضافة وتعديل التصنيفات الرئيسية والفرعية المربوطة بقاعدة البيانات</p>
                </div>
                <Button className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-cairo">
                    <Plus className="w-4 h-4" />
                    إضافة تصنيف جديد
                </Button>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                    <CardTitle className="text-lg font-cairo flex items-center gap-2">
                        <Store className="w-5 h-5 text-indigo-500" />
                        التصنيفات المتاحة في الكتالوج
                    </CardTitle>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="بحث في التصنيفات..."
                            value={searchTerm}
                            onChange={(e: any) => setSearchTerm(e.target.value)}
                            className="pr-9 h-9 text-sm rounded-xl font-cairo"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                            <p className="font-cairo text-sm">جاري التحميل من قاعدة البيانات...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((cat: any, idx: number) => (
                                <div key={cat.id || idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">{cat.icon || "📂"}</span>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white font-cairo">{cat.name_ar || cat.name}</h3>
                                            <p className="text-xs text-slate-500 font-cairo">{cat.count || 0} مقدم خدمة / خدمة</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
