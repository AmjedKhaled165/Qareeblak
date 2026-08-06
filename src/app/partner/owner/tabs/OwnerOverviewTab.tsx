"use client";

import { motion } from "framer-motion";
import { DollarSign, CheckCircle, ListOrdered, Bike, MapPin, Users, ShoppingBag } from "lucide-react";
import { useMemo } from "react";

// Stats Card Component with Light/Dark Mode Support
function StatsCard({ title, value, icon: Icon, color, onClick }: { title: string; value: string | number; icon: any; color: string; onClick?: () => void }) {
    const getColorClasses = (colorKey: string) => {
        switch (colorKey.toLowerCase()) {
            case '#10b981':
            case 'emerald':
                return {
                    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
                    border: 'border-emerald-200 dark:border-emerald-500/30',
                    text: 'text-emerald-600 dark:text-emerald-400',
                    iconBg: 'bg-emerald-500'
                };
            case '#06b6d4':
            case 'cyan':
                return {
                    bg: 'bg-cyan-100 dark:bg-cyan-500/20',
                    border: 'border-cyan-200 dark:border-cyan-500/30',
                    text: 'text-cyan-600 dark:text-cyan-400',
                    iconBg: 'bg-cyan-500'
                };
            case '#3b82f6':
            case 'blue':
                return {
                    bg: 'bg-blue-100 dark:bg-blue-500/20',
                    border: 'border-blue-200 dark:border-blue-500/30',
                    text: 'text-blue-600 dark:text-blue-400',
                    iconBg: 'bg-blue-500'
                };
            case '#6366f1':
            case 'indigo':
                return {
                    bg: 'bg-indigo-100 dark:bg-indigo-500/20',
                    border: 'border-indigo-200 dark:border-indigo-500/30',
                    text: 'text-indigo-600 dark:text-indigo-400',
                    iconBg: 'bg-indigo-500'
                };
            case '#8b5cf6':
            case 'violet':
                return {
                    bg: 'bg-violet-100 dark:bg-violet-500/20',
                    border: 'border-violet-200 dark:border-violet-500/30',
                    text: 'text-violet-600 dark:text-violet-400',
                    iconBg: 'bg-violet-500'
                };
            case '#f59e0b':
            case 'amber':
                return {
                    bg: 'bg-amber-100 dark:bg-amber-500/20',
                    border: 'border-amber-200 dark:border-amber-500/30',
                    text: 'text-amber-600 dark:text-amber-400',
                    iconBg: 'bg-amber-500'
                };
            default:
                return {
                    bg: 'bg-slate-100 dark:bg-slate-500/20',
                    border: 'border-slate-200 dark:border-slate-500/30',
                    text: 'text-slate-600 dark:text-slate-400',
                    iconBg: 'bg-slate-500'
                };
        }
    };

    const classes = useMemo(() => getColorClasses(color), [color]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`
                bg-white dark:bg-slate-800
                backdrop-blur-xl 
                border border-slate-200 dark:border-slate-700
                rounded-2xl p-5 
                shadow-lg shadow-slate-200/50 dark:shadow-none
                flex-1 min-w-[150px] 
                ${onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-3">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${classes.bg} border ${classes.border}`}
                >
                    <Icon className={`w-6 h-6 ${classes.text}`} />
                </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        </motion.div>
    );
}

interface OverviewTabProps {
    stats: any;
    onNavigateTab: (tab: string) => void;
}

export default function OwnerOverviewTab({ stats, onNavigateTab }: OverviewTabProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            {/* Stats Cards */}
            {stats?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                        title="إجمالي الإيرادات"
                        value={`${parseFloat(stats.summary.total_delivery_fees || 0).toFixed(0)} ج.م`}
                        icon={DollarSign}
                        color="#10B981"
                    />
                    <StatsCard
                        title="Qareeblak - رسوم التوصيل"
                        value={`${parseFloat(stats.summary.qareeblak_delivery_revenue || 0).toFixed(0)} ج.م`}
                        icon={Bike}
                        color="#8B5CF6"
                        onClick={() => onNavigateTab('orders')}
                    />
                    <StatsCard
                        title="طلبات ناجحة"
                        value={stats.summary.delivered}
                        icon={CheckCircle}
                        color="#6366F1"
                    />
                    <StatsCard
                        title="كل الطلبات"
                        value={stats.summary.total_orders}
                        icon={ListOrdered}
                        color="#F59E0B"
                        onClick={() => onNavigateTab('orders')}
                    />
                </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => onNavigateTab('orders')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
                >
                    <ListOrdered className="w-4 h-4" />
                    كل الطلبات
                </button>
                <button
                    onClick={() => onNavigateTab('team')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 rounded-xl text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-500/20 transition-all shadow-sm"
                >
                    <Users className="w-4 h-4" />
                    إدارة الفريق
                </button>
                <button
                    onClick={() => onNavigateTab('products')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20 rounded-xl text-xs font-bold hover:bg-pink-200 dark:hover:bg-pink-500/20 transition-all shadow-sm"
                >
                    <ShoppingBag className="w-4 h-4" />
                    المنتجات
                </button>
            </div>

            {/* Manager Performance Section */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                    <span className="w-1 h-6 bg-indigo-500 rounded-full" />
                    أداء المناطق (المسؤولين)
                </h2>

                <div className="space-y-4">
                    {stats?.managers?.length === 0 ? (
                        <div className="text-center py-16 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
                            <p className="text-slate-500">لا يوجد مسؤولين حالياً</p>
                        </div>
                    ) : (
                        stats?.managers?.map((manager: any, idx: number) => (
                            <motion.div
                                key={manager.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none hover:border-indigo-300 dark:hover:border-primary/30 transition-all group"
                            >
                                {/* Manager Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <img
                                                src={manager.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(manager.manager_name || 'M')}&background=6366f1&color=fff`}
                                                alt={manager.manager_name}
                                                className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200 dark:border-white/10 group-hover:border-indigo-400 dark:group-hover:border-primary/50 transition-all shadow-lg"
                                            />
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#0F172A] rounded-full" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-primary transition-colors">{manager.manager_name}</p>
                                            <p className="text-xs text-slate-500 font-medium">مسؤول منطقة</p>
                                        </div>
                                    </div>
                                    <span className="px-5 py-2 bg-indigo-100 dark:bg-primary/10 text-indigo-600 dark:text-primary border border-indigo-200 dark:border-primary/20 rounded-full text-xs font-bold">
                                        {manager.driver_count || 0} مناديب
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-black/20 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                    <div className="p-3 rounded-xl text-center hover:bg-white dark:hover:bg-white/5 transition-all">
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">الطلبات</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{manager.total_orders}</p>
                                    </div>
                                    <div className="p-3 rounded-xl text-center border-x border-slate-200 dark:border-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all">
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">التوصيل</p>
                                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(manager.delivery_fees || 0).toFixed(0)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl text-center">
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">المبيعات</p>
                                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{parseFloat(manager.sales || 0).toFixed(0)}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
