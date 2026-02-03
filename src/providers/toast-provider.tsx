"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

// Types
type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 5 seconds to give time to read
        setTimeout(() => removeToast(id), 5000);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Toast Container - Top Center for maximum visibility */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 w-full max-w-md px-4 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="pointer-events-auto relative overflow-hidden bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-4 p-4 pr-12 w-full"
                        >
                            {/* Accent Bar */}
                            <div className={`absolute right-0 top-0 bottom-0 w-1.5 
                                ${t.type === "success" ? "bg-emerald-500" : ""}
                                ${t.type === "error" ? "bg-red-500" : ""}
                                ${t.type === "info" ? "bg-blue-500" : ""}
                            `} />

                            {/* Icon */}
                            <div className={`mt-0.5 shrink-0
                                ${t.type === "success" ? "text-emerald-500" : ""}
                                ${t.type === "error" ? "text-red-500" : ""}
                                ${t.type === "info" ? "text-blue-500" : ""}
                            `}>
                                {t.type === "success" && <CheckCircle2 className="w-6 h-6" />}
                                {t.type === "error" && <AlertCircle className="w-6 h-6" />}
                                {t.type === "info" && <Info className="w-6 h-6" />}
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                <h4 className={`font-bold text-base mb-1
                                    ${t.type === "success" ? "text-emerald-950 dark:text-emerald-50" : ""}
                                    ${t.type === "error" ? "text-red-950 dark:text-red-50" : ""}
                                    ${t.type === "info" ? "text-blue-950 dark:text-blue-50" : ""}
                                `}>
                                    {t.type === "success" ? "تم بنجاح" : t.type === "error" ? "تنبيه" : "معلومة"}
                                </h4>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {t.message}
                                </p>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => removeToast(t.id)}
                                title="إغلاق"
                                aria-label="إغلاق"
                                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
