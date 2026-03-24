"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    Plus,
    Search,
    Trash2,
    ShoppingBag,
    Loader2,
    X
} from "lucide-react";
import { apiCall } from "@/lib/api";
import { useToast } from "@/components/providers/ToastProvider";
import StatusModal from "@/components/ui/status-modal";

interface Product {
    id: number;
    name: string;
    created_at: string;
}

export default function ProductsManagementPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [newProductName, setNewProductName] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // Modal state for confirmation
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (!storedUser || JSON.parse(storedUser).role !== 'owner') {
            router.push('/partner/dashboard');
            return;
        }
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const data = await apiCall('/halan/products');
            if (data.success) {
                setProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast('حدث خطأ أثناء تحميل المنتجات', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductName.trim()) return;

        setIsAdding(true);
        try {
            const data = await apiCall('/halan/products', {
                method: 'POST',
                body: JSON.stringify({ name: newProductName.trim() })
            });

            if (data.success) {
                setProducts(prev => [data.data, ...prev]);
                setNewProductName("");
                toast('تم إضافة المنتج بنجاح', 'success');
            } else {
                toast(data.error || 'فشل إضافة المنتج', 'error');
            }
        } catch (error) {
            toast('حدث خطأ في الاتصال بالسيرفر', 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const confirmDelete = (product: Product) => {
        setModal({
            isOpen: true,
            title: 'حذف منتج',
            message: `هل أنت متأكد من حذف المنتج "${product.name}"؟`,
            type: 'warning',
            onConfirm: () => handleDelete(product.id)
        });
    };

    const handleDelete = async (id: number) => {
        try {
            const data = await apiCall(`/halan/products/${id}`, {
                method: 'DELETE'
            });

            if (data.success) {
                setProducts(prev => prev.filter(p => p.id !== id));
                setModal(prev => ({ ...prev, isOpen: false }));
                toast('تم حذف المنتج', 'success');
            }
        } catch (error) {
            toast('حدث خطأ أثناء الحذف', 'error');
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="الرجوع للخلف" aria-label="الرجوع للخلف">
                        <ArrowRight className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">إدارة المنتجات</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">تحسين سرعة إدخال الطلبات</p>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6">
                {/* Add Product Form */}
                <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleAddProduct}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 space-y-4"
                >
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">إضافة منتج جديد</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="اسم المنتج (مثال: جبنة عبور لاند)"
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-600 transition-all font-medium"
                        />
                        <button
                            type="submit"
                            disabled={isAdding || !newProductName.trim()}
                            className="bg-violet-600 text-white px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                            إضافة
                        </button>
                    </div>
                </motion.form>

                {/* Search and List */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث في المنتجات المضافة..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 rounded-xl py-3 pr-10 pl-4 shadow-sm outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                        />
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-white/5">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span>اسم المنتج</span>
                            <span>العمليات</span>
                        </div>

                        {isLoading ? (
                            <div className="py-20 flex justify-center">
                                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="py-20 text-center text-slate-400">
                                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>لا توجد منتجات مضافة</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                <AnimatePresence mode='popLayout'>
                                    {filteredProducts.map((product) => (
                                        <motion.div
                                            key={product.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                        >
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{product.name}</span>
                                            <button
                                                onClick={() => confirmDelete(product)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                title={`حذف ${product.name}`}
                                                aria-label={`حذف ${product.name}`}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <StatusModal
                isOpen={modal.isOpen}
                onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
        </div>
    );
}
