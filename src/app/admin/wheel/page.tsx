"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { Plus, Edit2, Trash2, Gift, Check, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/ToastProvider";
import { wheelApi } from "@/lib/api";

export default function AdminWheelPrizesPage() {
    const { currentUser } = useAppStore();
    const { toast } = useToast();
    const [prizes, setPrizes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        prize_type: "discount_percent",
        prize_value: 0,
        provider_id: "",
        probability: 10,
        color: "#f44336",
        is_active: true
    });

    useEffect(() => {
        loadPrizes();
    }, []);

    const loadPrizes = async () => {
        setIsLoading(true);
        try {
            const data = await wheelApi.adminGetPrizes();
            setPrizes(data || []);
        } catch (error) {
            console.error(error);
            toast("فشل في تحميل الجوائز", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (prize: any = null) => {
        if (prize) {
            setEditingId(prize.id);
            setFormData({
                name: prize.name,
                prize_type: prize.prize_type,
                prize_value: prize.prize_value,
                provider_id: prize.provider_id || "",
                probability: prize.probability,
                color: prize.color,
                is_active: prize.is_active
            });
        } else {
            setEditingId(null);
            setFormData({
                name: "",
                prize_type: "discount_percent",
                prize_value: 10,
                provider_id: "",
                probability: 10,
                color: "#f44336",
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast("يرجى إدخال اسم الجائزة", "error");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                provider_id: formData.provider_id ? parseInt(formData.provider_id) : null
            };

            if (editingId) {
                await wheelApi.adminUpdatePrize(editingId, payload);
                toast("تم تحديث الجائزة بنجاح", "success");
            } else {
                await wheelApi.adminAddPrize(payload);
                toast("تمت إضافة الجائزة بنجاح", "success");
            }
            setIsModalOpen(false);
            loadPrizes();
        } catch (error) {
            console.error(error);
            toast("حدث خطأ أثناء حفظ الجائزة", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("هل أنت متأكد من حذف هذه الجائزة؟")) return;
        
        try {
            await wheelApi.adminDeletePrize(id);
            toast("تم حذف الجائزة", "success");
            loadPrizes();
        } catch (error) {
            toast("خطأ في الحذف", "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Gift className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">إدارة عجلة الحظ</h1>
                        <p className="text-slate-500 text-sm">إضافة وتعديل جوائز وخصومات عجلة الحظ</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenModal()} className="rounded-xl flex gap-2">
                    <Plus className="w-5 h-5" />
                    <span>إضافة جائزة جديدة</span>
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 font-bold text-slate-600">الاسم</th>
                                <th className="p-4 font-bold text-slate-600">النوع</th>
                                <th className="p-4 font-bold text-slate-600">القيمة</th>
                                <th className="p-4 font-bold text-slate-600">الاحتمالية</th>
                                <th className="p-4 font-bold text-slate-600">الحالة</th>
                                <th className="p-4 font-bold text-slate-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prizes.map((prize) => (
                                <tr key={prize.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-4 h-4 rounded-full" 
                                                style={{ backgroundColor: prize.color || '#ccc' }} 
                                            />
                                            <span className="font-bold">{prize.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-600">
                                            {prize.prize_type === 'discount_percent' ? 'خصم مئوي (%)' :
                                             prize.prize_type === 'discount_flat' ? 'خصم ثابت (ج.م)' :
                                             prize.prize_type === 'free_delivery' ? 'توصيل مجاني' : prize.prize_type}
                                        </span>
                                    </td>
                                    <td className="p-4 font-bold text-primary">
                                        {prize.prize_value} {prize.prize_type === 'discount_percent' ? '%' : 'ج.م'}
                                    </td>
                                    <td className="p-4">{prize.probability}</td>
                                    <td className="p-4">
                                        {prize.is_active ? (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md flex items-center gap-1 w-fit">
                                                <Check className="w-3 h-3" /> مفعل
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md flex items-center gap-1 w-fit">
                                                <X className="w-3 h-3" /> معطل
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleOpenModal(prize)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(prize.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {prizes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-slate-500">
                                        لا توجد جوائز مضافة حتى الان
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">{editingId ? 'تعديل الجائزة' : 'إضافة جائزة جديدة'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">اسم الجائزة (يظهر للمستخدم)</label>
                                <Input 
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="مثال: خصم 10% أو توصيل مجاني"
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-1 block">نوع الجائزة</label>
                                    <select 
                                        className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                                        value={formData.prize_type}
                                        onChange={e => setFormData({...formData, prize_type: e.target.value})}
                                    >
                                        <option value="discount_percent">خصم نسبة مئوية (%)</option>
                                        <option value="discount_flat">خصم مبلغ ثابت (ج.م)</option>
                                        <option value="free_delivery">توصيل مجاني</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-1 block">القيمة</label>
                                    <Input 
                                        type="number"
                                        value={formData.prize_value}
                                        onChange={e => setFormData({...formData, prize_value: parseFloat(e.target.value) || 0})}
                                        className="rounded-xl"
                                        disabled={formData.prize_type === 'free_delivery'}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-1 block">الاحتمالية (الوزن من 100)</label>
                                    <Input 
                                        type="number"
                                        value={formData.probability}
                                        onChange={e => setFormData({...formData, probability: parseInt(e.target.value) || 0})}
                                        className="rounded-xl"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">رقم أكبر = احتمال فوز أعلى</p>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-1 block">لون القطعة في العجلة</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="color"
                                            value={formData.color}
                                            onChange={e => setFormData({...formData, color: e.target.value})}
                                            className="h-10 w-10 rounded cursor-pointer"
                                        />
                                        <Input 
                                            value={formData.color}
                                            onChange={e => setFormData({...formData, color: e.target.value})}
                                            className="rounded-xl flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">معرف المتجر (اختياري)</label>
                                <Input 
                                    type="number"
                                    value={formData.provider_id}
                                    onChange={e => setFormData({...formData, provider_id: e.target.value})}
                                    placeholder="اتركه فارغاً إذا كان الخصم عام"
                                    className="rounded-xl"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer pt-2">
                                <input 
                                    type="checkbox" 
                                    checked={formData.is_active}
                                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-bold text-slate-700">تفعيل الجائزة</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t mt-4">
                            <Button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="flex-1 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الجائزة"}
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 rounded-xl"
                            >
                                إلغاء
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
