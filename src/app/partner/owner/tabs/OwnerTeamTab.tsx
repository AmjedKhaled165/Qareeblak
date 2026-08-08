"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Search, UserPlus, Trash2, X, Loader2, Check, Phone, MapPin, User, Settings, Users, Truck, FileSpreadsheet
} from "lucide-react";
import { apiCall } from "@/lib/api";
import StatusModal from "@/components/ui/status-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { PasswordInput } from "@/components/ui/password-input";

type SubTab = 'managers' | 'drivers';

interface OwnerTeamTabProps {
    period: 'today' | 'week' | 'month' | 'custom';
    customDate: string;
    rawOrders: any[];
    rawUsers: any[];
}

const normalizeSourceKey = (source?: string) => {
    const value = String(source || '').toLowerCase();
    if (value.includes('qareeblak')) return 'qareeblak';
    if (value.includes('whatsapp') || value.includes('واتس') || value.includes('وتس')) return 'whatsapp';
    if (value.includes('maintenance') || value.includes('صيانة')) return 'maintenance';
    if (value.includes('manual') || value.includes('يدوي')) return 'manual';
    return value || 'unknown';
};

const mapSourceLabel = (source: string | undefined) => {
    switch (normalizeSourceKey(source)) {
        case 'qareeblak': return 'قريبلك';
        case 'manual': return 'يدوي';
        case 'whatsapp': return 'واتساب';
        case 'maintenance': return 'صيانة';
        default: return source || 'غير محدد';
    }
};

export default function OwnerTeamTab({ period, customDate, rawOrders, rawUsers }: OwnerTeamTabProps) {
    const router = useRouter();
    const [subTab, setSubTab] = useState<SubTab>('managers');

    // ──── Shared state ────
    const [managers, setManagers] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [managerCounts, setManagerCounts] = useState<Record<number, number>>({});
    const [searchManagers, setSearchManagers] = useState("");
    const [searchDrivers, setSearchDrivers] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    // ──── Modals ────
    const [showAddManagerModal, setShowAddManagerModal] = useState(false);
    const [showAddDriverModal, setShowAddDriverModal] = useState(false);

    const [modalState, setModalState] = useState<{
        isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; onCloseAction?: () => void;
    }>({ isOpen: false, title: '', message: '', type: 'info' });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; title: string; message: string; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // ──── New manager/driver forms ────
    const [newManager, setNewManager] = useState({ name: '', username: '', email: '', phone: '', password: '', role: 'supervisor' });
    const [newDriver, setNewDriver] = useState({ name: '', username: '', email: '', phone: '', password: '', role: 'courier', supervisorId: '' });

    // ──── Data Fetch ────
    useEffect(() => {
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setIsOwner(user.role === 'owner');
        }
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const data = await apiCall('/halan/users');
            if (data.success) {
                const allUsers = data.data;
                const supervisors = allUsers.filter((u: any) => u.role === 'supervisor');
                const couriers = allUsers.filter((u: any) => u.role === 'courier');

                const counts: Record<number, number> = {};
                supervisors.forEach((s: any) => {
                    const assigned = couriers.filter((c: any) =>
                        (c.supervisorIds || []).map((id: any) => Number(id)).includes(Number(s.id))
                    );
                    counts[s.id] = assigned.length;
                    s.assignedNames = assigned.map((c: any) => c.name);
                });

                setManagers(supervisors);
                setDrivers(couriers);
                setManagerCounts(counts);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // ──── Manager Actions ────
    const filteredManagers = managers.filter(m =>
        (m.name || '').toLowerCase().includes(searchManagers.toLowerCase()) ||
        (m.username || '').toLowerCase().includes(searchManagers.toLowerCase())
    );

    const handleAddManager = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const data = await apiCall('/halan/auth/register', { method: 'POST', body: JSON.stringify(newManager) });
            if (data.success) {
                setModalState({ isOpen: true, title: 'تم بنجاح', message: 'تم إضافة المسؤول بنجاح', type: 'success' });
                setShowAddManagerModal(false);
                setNewManager({ name: '', username: '', email: '', phone: '', password: '', role: 'supervisor' });
                fetchAll();
            } else {
                setModalState({ isOpen: true, title: 'خطأ', message: data.error || 'فشل إضافة المسؤول', type: 'error' });
            }
        } catch (error: any) {
            setModalState({ isOpen: true, title: 'خطأ', message: error?.message || 'حدث خطأ غير متوقع', type: 'error' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteManager = (id: number) => {
        setConfirmModal({
            isOpen: true, title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا المسؤول نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const data = await apiCall(`/halan/users/${id}`, { method: 'DELETE' });
                    if (data.success) {
                        setModalState({ isOpen: true, title: 'تم بنجاح', message: 'تم الحذف بنجاح', type: 'success', onCloseAction: () => fetchAll() });
                    } else {
                        setModalState({ isOpen: true, title: 'خطأ', message: data.error || 'فشل عملية الحذف', type: 'error' });
                    }
                } catch (error: any) {
                    setModalState({ isOpen: true, title: 'خطأ', message: error.message || 'حدث خطأ غير متوقع أثناء الحذف', type: 'error' });
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const handleToggleManagerAvailability = async (manager: any) => {
        if (!isOwner) return;
        const next = !Boolean(manager.isAvailable);
        setManagers((prev) => prev.map((m) => (m.id === manager.id ? { ...m, isAvailable: next } : m)));
        try {
            await apiCall(`/halan/users/${manager.id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable: next }) });
        } catch {
            setManagers((prev) => prev.map((m) => (m.id === manager.id ? { ...m, isAvailable: !next } : m)));
            setModalState({ isOpen: true, title: 'خطأ', message: 'تعذر تحديث حالة المسؤول', type: 'error' });
        }
    };

    // ──── Driver Actions ────
    const filteredDrivers = drivers.filter(d => {
        const matchesSearch = (d.name || '').toLowerCase().includes(searchDrivers.toLowerCase()) || (d.username || '').toLowerCase().includes(searchDrivers.toLowerCase());
        if (!isOwner && d.isAvailable === false) return false;
        return matchesSearch;
    });

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const data = await apiCall('/halan/auth/register', { method: 'POST', body: JSON.stringify(newDriver) });
            if (data.success) {
                setModalState({ isOpen: true, title: 'تم بنجاح', message: 'تم إضافة المندوب بنجاح', type: 'success' });
                setShowAddDriverModal(false);
                setNewDriver({ name: '', username: '', email: '', phone: '', password: '', role: 'courier', supervisorId: '' });
                fetchAll();
            } else {
                setModalState({ isOpen: true, title: 'خطأ', message: data.error || 'فشل إضافة المندوب', type: 'error' });
            }
        } catch (error: any) {
            setModalState({ isOpen: true, title: 'خطأ', message: error?.message || 'حدث خطأ غير متوقع', type: 'error' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteDriver = (id: number) => {
        setConfirmModal({
            isOpen: true, title: 'حذف المندوب', message: 'هل أنت متأكد من حذف هذا المندوب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setIsActionLoading(true);
                try {
                    const data = await apiCall(`/halan/users/${id}`, { method: 'DELETE' });
                    if (data.success) {
                        setModalState({ isOpen: true, title: 'تم بنجاح', message: 'تم الحذف بنجاح', type: 'success', onCloseAction: () => fetchAll() });
                    }
                } catch {
                    setModalState({ isOpen: true, title: 'خطأ', message: 'حدث خطأ غير متوقع أثناء الحذف', type: 'error' });
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const handleToggleDriverAvailability = async (driver: any) => {
        const newStatus = !driver.isAvailable;
        setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, isAvailable: newStatus } : d));
        try {
            await apiCall(`/halan/users/${driver.id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable: newStatus }) });
        } catch {
            setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, isAvailable: !newStatus } : d));
        }
    };

    const handleAssign = async (userId: number, supervisorId: number, action: 'add' | 'remove') => {
        try {
            const data = await apiCall('/halan/users/assign', { method: 'POST', body: JSON.stringify({ userId, supervisorId, action }) });
            if (data.success) fetchAll();
        } catch (error) {
            console.error('Assign error:', error);
        }
    };

    // ──── Excel Export ────
    const [isExporting, setIsExporting] = useState(false);

    const isDateInPeriod = useCallback((dateString: string, p: string, customDateVal?: string) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return false;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (p === 'today') return date >= start;
        if (p === 'week') { const day = start.getDay(); const diff = (day + 1) % 7; start.setDate(start.getDate() - diff); return date >= start; }
        if (p === 'month') { start.setDate(1); return date >= start; }
        if (p === 'custom' && customDateVal) { const cs = new Date(customDateVal); cs.setHours(0, 0, 0, 0); const ce = new Date(customDateVal); ce.setHours(23, 59, 59, 999); return date >= cs && date <= ce; }
        return true;
    }, []);

    const getGrandTotal = useCallback((o: any) => {
        let items: any[] = [];
        try { items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []); } catch { items = []; }
        const itemsTotal = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
        const deliFee = parseFloat(o.delivery_fee?.toString() || '0');
        return itemsTotal + deliFee;
    }, []);

    const getItemsTotal = useCallback((o: any) => {
        let items: any[] = [];
        try { items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []); } catch { items = []; }
        return items.reduce((sum: number, item: any) => sum + ((parseFloat(item.price || item.unit_price) || 0) * (parseFloat(item.quantity) || 1)), 0);
    }, []);

    const getPeriodLabel = useCallback(() => {
        switch (period) {
            case 'today': return 'اليوم';
            case 'week': return 'هذا الأسبوع';
            case 'month': return 'هذا الشهر';
            case 'custom': return customDate || 'يوم محدد';
            default: return '';
        }
    }, [period, customDate]);

    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        try {
            const XLSX = (await import('xlsx')).default;

            const filteredOrders = rawOrders.filter((o: any) => isDateInPeriod(o.created_at, period, customDate));
            const allManagers = rawUsers.filter((u: any) => u.role === 'supervisor');
            const allDrivers = rawUsers.filter((u: any) => u.role === 'courier');

            const sessionsRes = await apiCall('/halan/users/sessions');
            const allSessions = sessionsRes.success ? sessionsRes.data : [];

            // ──── Helper to compute stats for a user ────
            const computeUserStats = (userOrders: any[]) => {
                const delivered = userOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
                const totalDeliveryFees = delivered.reduce((sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0);
                const totalSales = delivered.reduce((sum: number, o: any) => sum + getItemsTotal(o), 0);
                const totalWithFees = delivered.reduce((sum: number, o: any) => sum + getGrandTotal(o), 0);

                const qareeblakOrders = userOrders.filter((o: any) => normalizeSourceKey(o.source) === 'qareeblak');
                const manualOrders = userOrders.filter((o: any) => normalizeSourceKey(o.source) === 'manual');
                const whatsappOrders = userOrders.filter((o: any) => normalizeSourceKey(o.source) === 'whatsapp');

                const qareeblakDelivered = qareeblakOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
                const manualDelivered = manualOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));
                const whatsappDelivered = whatsappOrders.filter((o: any) => ['delivered', 'تم التوصيل'].includes(o.status));

                return {
                    totalOrders: userOrders.length,
                    deliveredCount: delivered.length,
                    pendingCount: userOrders.filter((o: any) => o.status === 'pending').length,
                    cancelledCount: userOrders.filter((o: any) => ['cancelled', 'deleted'].includes(o.status)).length,
                    totalDeliveryFees,
                    totalSales,
                    totalWithFees,
                    qareeblakCount: qareeblakOrders.length,
                    qareeblakDeliveredCount: qareeblakDelivered.length,
                    qareeblakFees: qareeblakDelivered.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0),
                    qareeblakSales: qareeblakDelivered.reduce((s: number, o: any) => s + getItemsTotal(o), 0),
                    manualCount: manualOrders.length,
                    manualDeliveredCount: manualDelivered.length,
                    manualFees: manualDelivered.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0),
                    manualSales: manualDelivered.reduce((s: number, o: any) => s + getItemsTotal(o), 0),
                    whatsappCount: whatsappOrders.length,
                    whatsappDeliveredCount: whatsappDelivered.length,
                    whatsappFees: whatsappDelivered.reduce((s: number, o: any) => s + parseFloat(o.delivery_fee || '0'), 0),
                    whatsappSales: whatsappDelivered.reduce((s: number, o: any) => s + getItemsTotal(o), 0),
                };
            };

            // ──── Build the worksheet data ────
            const wsData: any[][] = [];

            // Title row
            wsData.push([`تقرير الفريق - ${getPeriodLabel()}`]);
            wsData.push([`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`]);
            wsData.push([]); // Empty row

            // ════════════════ SUPERVISORS SECTION ════════════════
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push(['قسم المسؤولين']);
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push([]);

            // Supervisor Summary Header
            wsData.push([
                'اسم المسؤول', 'إجمالي الطلبات', 'طلبات مكتملة', 'طلبات معلقة', 'طلبات ملغاة',
                'رسوم التوصيل (ج.م)', 'مبيعات المنتجات (ج.م)', 'الإجمالي الكلي (ج.م)',
                'طلبات قريبلك', 'مكتملة قريبلك', 'رسوم قريبلك', 'مبيعات قريبلك',
                'طلبات يدوي', 'مكتملة يدوي', 'رسوم يدوي', 'مبيعات يدوي',
                'طلبات واتساب', 'مكتملة واتساب', 'رسوم واتساب', 'مبيعات واتساب'
            ]);

            for (const mgr of allManagers) {
                const mgrOrders = filteredOrders.filter((o: any) => Number(o.supervisor_id) === Number(mgr.id));
                const stats = computeUserStats(mgrOrders);
                wsData.push([
                    mgr.name, stats.totalOrders, stats.deliveredCount, stats.pendingCount, stats.cancelledCount,
                    stats.totalDeliveryFees, stats.totalSales, stats.totalWithFees,
                    stats.qareeblakCount, stats.qareeblakDeliveredCount, stats.qareeblakFees, stats.qareeblakSales,
                    stats.manualCount, stats.manualDeliveredCount, stats.manualFees, stats.manualSales,
                    stats.whatsappCount, stats.whatsappDeliveredCount, stats.whatsappFees, stats.whatsappSales
                ]);
            }

            wsData.push([]); // Separator
            wsData.push([]); // Separator

            // ════════════════ COURIERS SECTION ════════════════
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push(['قسم المناديب']);
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push([]);

            // Courier Summary Header
            wsData.push([
                'اسم المندوب', 'وقت بدء العمل', 'إجمالي الطلبات', 'طلبات مكتملة', 'طلبات معلقة', 'طلبات ملغاة',
                'رسوم التوصيل (ج.م)', 'مبيعات المنتجات (ج.م)', 'الإجمالي الكلي (ج.م)',
                'طلبات قريبلك', 'مكتملة قريبلك', 'رسوم قريبلك', 'مبيعات قريبلك',
                'طلبات يدوي', 'مكتملة يدوي', 'رسوم يدوي', 'مبيعات يدوي',
                'طلبات واتساب', 'مكتملة واتساب', 'رسوم واتساب', 'مبيعات واتساب'
            ]);

            for (const drv of allDrivers) {
                const drvOrders = filteredOrders.filter((o: any) => Number(o.courier_id) === Number(drv.id));
                const stats = computeUserStats(drvOrders);
                
                // Get start time for the period (first session matching the period)
                const drvSessions = allSessions.filter((s: any) => Number(s.courier_id) === Number(drv.id) && isDateInPeriod(s.session_date, period, customDate));
                drvSessions.sort((a: any, b: any) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
                const firstSession = drvSessions.length > 0 ? new Date(drvSessions[0].started_at).toLocaleString('ar-EG', { hour: '2-digit', minute:'2-digit', second:'2-digit', hour12:true, year:'numeric', month:'2-digit', day:'2-digit' }) : 'لم يتم تسجيل بدء عمل';

                wsData.push([
                    drv.name, firstSession, stats.totalOrders, stats.deliveredCount, stats.pendingCount, stats.cancelledCount,
                    stats.totalDeliveryFees, stats.totalSales, stats.totalWithFees,
                    stats.qareeblakCount, stats.qareeblakDeliveredCount, stats.qareeblakFees, stats.qareeblakSales,
                    stats.manualCount, stats.manualDeliveredCount, stats.manualFees, stats.manualSales,
                    stats.whatsappCount, stats.whatsappDeliveredCount, stats.whatsappFees, stats.whatsappSales
                ]);
            }

            wsData.push([]); // Separator
            wsData.push([]); // Separator

            // ════════════════ DETAILED ORDERS ════════════════
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push(['تفاصيل جميع الطلبات']);
            wsData.push(['═══════════════════════════════════════════════════════════════']);
            wsData.push([]);

            wsData.push([
                'رقم الطلب', 'اسم العميل', 'رقم العميل', 'عنوان التوصيل', 'الحالة',
                'المصدر', 'المسؤول', 'المندوب', 'المنتجات', 'سعر المنتجات (ج.م)',
                'رسوم التوصيل (ج.م)', 'الإجمالي (ج.م)', 'تاريخ الإنشاء'
            ]);

            const statusLabels: Record<string, string> = {
                pending: 'قيد الانتظار', assigned: 'تم التعيين', in_progress: 'قيد التوصيل',
                out_for_delivery: 'في الطريق', delivered: 'مكتمل', cancelled: 'ملغي', deleted: 'ملغي'
            };

            for (const order of filteredOrders) {
                let items: any[] = [];
                try { items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []); } catch { items = []; }
                const itemsNames = items.map((i: any) => `${i.name || i.product_name || 'منتج'} (${i.quantity || 1})`).join(' | ');
                const itemsTotal = getItemsTotal(order);
                const deliveryFee = parseFloat(order.delivery_fee || '0');

                const mgrName = allManagers.find((m: any) => Number(m.id) === Number(order.supervisor_id))?.name || '-';
                const drvName = allDrivers.find((d: any) => Number(d.id) === Number(order.courier_id))?.name || '-';

                wsData.push([
                    order.display_id || order.id,
                    order.customer_name || '-',
                    order.customer_phone || '-',
                    order.delivery_address || '-',
                    statusLabels[order.status] || order.status || '-',
                    mapSourceLabel(order.source),
                    mgrName,
                    drvName,
                    itemsNames || '-',
                    itemsTotal,
                    deliveryFee,
                    itemsTotal + deliveryFee,
                    order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-'
                ]);
            }

            // ──── Create workbook ────
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set column widths
            ws['!cols'] = [
                { wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 18 }, { wch: 20 }, { wch: 18 },
                { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
            ];

            const periodForFileName = period === 'custom' ? (customDate || 'custom') : period;
            XLSX.utils.book_append_sheet(wb, ws, 'تقرير الفريق');
            XLSX.writeFile(wb, `تقرير_الفريق_${periodForFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);

        } catch (error) {
            console.error('Export error:', error);
            setModalState({ isOpen: true, title: 'خطأ', message: 'حدث خطأ أثناء تصدير الملف', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    }, [rawOrders, rawUsers, period, customDate, isDateInPeriod, getGrandTotal, getItemsTotal, getPeriodLabel]);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Export Button + Sub-tab selector */}
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setSubTab('managers')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'managers'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        المسؤولين ({managers.length})
                    </button>
                    <button
                        onClick={() => setSubTab('drivers')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'drivers'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Truck className="w-4 h-4" />
                        المناديب ({drivers.length})
                    </button>
                </div>
                <button
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    title={`تصدير شيت إكسل (${getPeriodLabel()})`}
                    className="h-[52px] px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                    <span className="hidden sm:inline">تصدير</span>
                </button>
            </div>

            {/* ══════════════ MANAGERS SUB-TAB ══════════════ */}
            {subTab === 'managers' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {/* Header + Add */}
                    <div className="flex items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input type="text" placeholder="بحث عن مسؤول..." value={searchManagers} onChange={(e) => setSearchManagers(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                            />
                        </div>
                        {isOwner && (
                            <button onClick={() => setShowAddManagerModal(true)}
                                className="bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all mr-3">
                                <UserPlus className="w-4 h-4" />إضافة مسؤول
                            </button>
                        )}
                    </div>

                    {/* Manager List */}
                    {isLoading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredManagers.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">لا يوجد مسؤولين</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredManagers.map((manager) => (
                                <div
                                    key={manager.id}
                                    onClick={() => router.push(`/partner/manager-details/${manager.id}`)}
                                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700 cursor-pointer"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 flex-1">
                                            <img src={manager.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.name)}&background=random`} alt={manager.name}
                                                className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700" />
                                            <div>
                                                <p className="font-bold">{manager.name}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">@{manager.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-full text-[10px] font-bold">
                                                {(managerCounts[manager.id] || 0) === 0 ? 'بدون مناديب' : `${managerCounts[manager.id]} مناديب`}
                                            </span>
                                            <span className="text-[10px] text-slate-400 max-w-[120px] text-left truncate">{manager.assignedNames?.join(', ')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 border-t pt-3 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                                        {manager.phone && <a href={`tel:${manager.phone}`} className="flex items-center gap-1 hover:text-violet-600"><Phone className="w-4 h-4" />{manager.phone}</a>}
                                        <div className="flex-1" />
                                        {isOwner && (
                                            <label className="inline-flex items-center gap-2 cursor-pointer select-none" title="تشغيل أو إيقاف المسؤول">
                                                <span className={`text-xs font-bold ${manager.isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{manager.isAvailable ? 'شغال' : 'مقفول'}</span>
                                                <input type="checkbox" checked={Boolean(manager.isAvailable)} onChange={() => handleToggleManagerAvailability(manager)} className="sr-only" />
                                                <span className={`relative inline-block w-11 h-6 rounded-full transition-colors ${manager.isAvailable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                    <span className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-all ${manager.isAvailable ? 'left-1' : 'right-1'}`} />
                                                </span>
                                            </label>
                                        )}
                                        {isOwner && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteManager(manager.id); }} title="حذف المسؤول" aria-label="حذف المسؤول"
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* ══════════════ DRIVERS SUB-TAB ══════════════ */}
            {subTab === 'drivers' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input type="text" placeholder="بحث عن مندوب..." value={searchDrivers} onChange={(e) => setSearchDrivers(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                            />
                        </div>
                        {isOwner && (
                            <button onClick={() => setShowAddDriverModal(true)}
                                className="bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all mr-3">
                                <UserPlus className="w-4 h-4" />إضافة مندوب
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredDrivers.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">لا يوجد نتائج</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredDrivers.map((driver) => (
                                <div key={driver.id} className="group overflow-hidden rounded-2xl bg-white dark:bg-[#111827] shadow-sm border border-slate-100 dark:border-white/5 transition-all hover:shadow-md">
                                    <div onClick={() => router.push(`/partner/driver-details/${driver.id}`)} className="p-4 flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={driver.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=random`} alt={driver.name}
                                                    className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-700" />
                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${driver.isAvailable ? 'bg-green-500' : 'bg-slate-400'}`} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">{driver.name}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">@{driver.username}</p>
                                                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{driver.courierStatus || 'متاح'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={Boolean(driver.isAvailable)} title="تبديل توفر المندوب" onChange={() => handleToggleDriverAvailability(driver)} />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                            </label>
                                            <button onClick={() => router.push(`/partner/tracking/${driver.id}?name=${encodeURIComponent(driver.name)}&username=${driver.username}`)} title="تتبع الموقع"
                                                className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                                                <MapPin className="w-5 h-5" />
                                            </button>
                                            {isOwner && (
                                                <button onClick={() => handleDeleteDriver(driver.id)} title="حذف المندوب"
                                                    className="w-10 h-10 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Multi-Manager Assignment */}
                                    {isOwner && (
                                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-t border-slate-100 dark:border-white/5">
                                            <span className="text-slate-500 font-medium text-xs block mb-2">التعيين لمسؤولين:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {managers.map(m => {
                                                    const isAssigned = (driver.supervisorIds || []).includes(m.id);
                                                    return (
                                                        <label key={m.id}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-medium ${isAssigned ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                                                            <input type="checkbox" className="sr-only" checked={isAssigned} onChange={() => handleAssign(driver.id, m.id, isAssigned ? 'remove' : 'add')} />
                                                            {m.name}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* ══════════════ ADD MANAGER MODAL ══════════════ */}
            {showAddManagerModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddManagerModal(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold">إضافة مسؤول جديد</h2>
                            <button onClick={() => setShowAddManagerModal(false)} title="إغلاق" aria-label="إغلاق" className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAddManager} className="p-6 space-y-4">
                            <div><label className="text-xs text-slate-500 mr-2">اسم المسؤول</label><input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3" placeholder="أدخل الاسم" value={newManager.name} onChange={(e) => setNewManager({ ...newManager, name: e.target.value })} required /></div>
                            <div><label className="text-xs text-slate-500 mr-2">اسم المستخدم (للدخول)</label><input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono" placeholder="مثلاً: manager_1" value={newManager.username} onChange={(e) => setNewManager({ ...newManager, username: e.target.value })} required /></div>
                            <div><label className="text-xs text-slate-500 mr-2">كلمة المرور</label><PasswordInput className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3" placeholder="********" value={newManager.password} onChange={(e) => setNewManager({ ...newManager, password: e.target.value })} required /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs text-slate-500 mr-2">رقم الهاتف</label><input type="tel" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono text-sm" placeholder="01xxxxxxxxx" value={newManager.phone} onChange={(e) => setNewManager({ ...newManager, phone: e.target.value })} dir="ltr" /></div>
                                <div><label className="text-xs text-slate-500 mr-2">البريد الإلكتروني</label><input type="email" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm" placeholder="user@example.com" value={newManager.email} onChange={(e) => setNewManager({ ...newManager, email: e.target.value })} dir="ltr" /></div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="submit" disabled={isActionLoading} className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-all">
                                    {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}تأكيد الإضافة
                                </button>
                                <button type="button" onClick={() => setShowAddManagerModal(false)} className="px-6 bg-slate-100 dark:bg-slate-800 py-4 rounded-2xl font-bold">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════ ADD DRIVER MODAL ══════════════ */}
            {showAddDriverModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddDriverModal(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold">إضافة مندوب جديد</h2>
                            <button onClick={() => setShowAddDriverModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full" title="إغلاق"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                            <div><label className="text-xs text-slate-500 mr-2">اسم المندوب</label><input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3" placeholder="أدخل الاسم" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} required /></div>
                            <div><label className="text-xs text-slate-500 mr-2">اسم المستخدم (للدخول)</label><input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono" placeholder="مثلاً: ahmed_2024" value={newDriver.username} onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value })} required /></div>
                            <div><label className="text-xs text-slate-500 mr-2">كلمة المرور</label><PasswordInput className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3" placeholder="********" value={newDriver.password} onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })} required /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs text-slate-500 mr-2">رقم الهاتف</label><input type="tel" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono text-sm" placeholder="01xxxxxxxxx" value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} dir="ltr" /></div>
                                <div><label className="text-xs text-slate-500 mr-2">البريد الإلكتروني</label><input type="email" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm" placeholder="user@example.com" value={newDriver.email} onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} dir="ltr" /></div>
                            </div>
                            <div><label className="text-xs text-slate-500 mr-2">تعيين لمسؤول (مشرف)</label>
                                <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3" value={newDriver.supervisorId} onChange={(e) => setNewDriver({ ...newDriver, supervisorId: e.target.value })} title="اختر المسؤول">
                                    <option value="">-- بدون تعيين حالياً --</option>
                                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="submit" disabled={isActionLoading} className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-all">
                                    {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}تأكيد الإضافة
                                </button>
                                <button type="button" onClick={() => setShowAddDriverModal(false)} className="px-6 bg-slate-100 dark:bg-slate-800 py-4 rounded-2xl font-bold">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shared Modals */}
            <StatusModal isOpen={modalState.isOpen} onClose={() => { setModalState(prev => ({ ...prev, isOpen: false })); if (modalState.onCloseAction) modalState.onCloseAction(); }} title={modalState.title} message={modalState.message} type={modalState.type} />
            <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} confirmText="حذف نهائي" cancelText="إلغاء" isDestructive={true} />
        </motion.div>
    );
}
