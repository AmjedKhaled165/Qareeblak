"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Search, Plus, Edit, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CatalogProductsPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const mockProducts = [
        { id: 101, name: "وجبة شاورما دجاج عائلي", category: "مطاعم ومأكولات", price: 180, provider: "مطعم ابن الشام", isAvailable: true },
        { id: 102, name: "بندول نايت 20 قرص", category: "صيدليات وأدوية", price: 35, provider: "صيدلية مصر", isAvailable: true },
        { id: 103, name: "زيت عباد الشمس 1 لتر", category: "سوبرماركت", price: 85, provider: "سوبرماركت الخير", isAvailable: true },
        { id: 104, name: "صيانة وتنظيف تكييف 1.5 حصان", category: "خدمات صيانة", price: 250, provider: "المركز الفني للصيانة", isAvailable: true },
    ];

    const filtered = mockProducts.filter(p => p.name.includes(searchTerm) || p.provider.includes(searchTerm));

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-cairo">🛍️ المنتجات والخدمات</h1>
                    <p className="text-slate-500 text-sm font-cairo mt-1">عرض وإدارة قائمة المنتجات والخدمات المسجلة في الكتالوج</p>
                </div>
                <Button className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4" />
                    إضافة منتج/خدمة
                </Button>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                    <CardTitle className="text-lg font-cairo flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-500" />
                        قائمة المنتجات والخدمات
                    </CardTitle>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="بحث بالاسم أو اسم المقدم..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pr-9 h-9 text-sm rounded-xl"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-cairo border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-3">اسم المنتج/الخدمة</th>
                                    <th className="p-3">التصنيف</th>
                                    <th className="p-3">مقدم الخدمة</th>
                                    <th className="p-3">السعر</th>
                                    <th className="p-3">الحالة</th>
                                    <th className="p-3">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-cairo">
                                {filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-3 font-bold text-slate-800 dark:text-white">{item.name}</td>
                                        <td className="p-3 text-slate-500">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">{item.category}</span>
                                        </td>
                                        <td className="p-3 text-slate-600 dark:text-slate-400">{item.provider}</td>
                                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.price} ج.م</td>
                                        <td className="p-3">
                                            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold">متاح</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
