"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import DriversMap from "@/components/partner/drivers-map";

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function OwnerMapModal({ isOpen, onClose }: MapModalProps) {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) setUser(JSON.parse(storedUser));
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && user && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[200] flex flex-col"
                    dir="rtl"
                >
                    {/* Header */}
                    <div className="bg-white dark:bg-slate-800 p-4 shadow-sm z-10 flex items-center justify-between">
                        <div>
                            <h1 className="font-bold text-slate-800 dark:text-white">خريطة المناديب</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">تتبع مباشر لأسطول التوصيل</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                            title="إغلاق الخريطة"
                            aria-label="إغلاق الخريطة"
                        >
                            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>

                    {/* Map */}
                    <div className="flex-1 p-2">
                        <DriversMap user={user} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
