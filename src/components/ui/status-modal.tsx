"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Info, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export type StatusModalType = 'success' | 'error' | 'info' | 'warning';

interface StatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: StatusModalType;
    autoClose?: boolean;
}

export default function StatusModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'success',
    autoClose = true
}: StatusModalProps) {

    useEffect(() => {
        if (isOpen && autoClose) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, autoClose, onClose]);

    const getConfig = () => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-500',
                    bgSoft: 'bg-green-500/20',
                    text: 'text-green-500',
                    shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.5)]',
                    icon: Check
                };
            case 'error':
                return {
                    bg: 'bg-red-500',
                    bgSoft: 'bg-red-500/20',
                    text: 'text-red-500',
                    shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]',
                    icon: X
                };
            case 'warning':
                return {
                    bg: 'bg-amber-500',
                    bgSoft: 'bg-amber-500/20',
                    text: 'text-amber-500',
                    shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                    icon: AlertTriangle
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-500',
                    bgSoft: 'bg-blue-500/20',
                    text: 'text-blue-500',
                    shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
                    icon: Info
                };
        }
    };

    const config = getConfig();
    const Icon = config.icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-slate-900 rounded-[30px] p-8 w-full max-w-sm text-center shadow-2xl border border-white/10"
                    >
                        {/* Icon */}
                        <div className={`w-20 h-20 ${config.bgSoft} rounded-full flex items-center justify-center mx-auto mb-6 relative`}>
                            {type === 'success' || type === 'error' ? (
                                <div className={`absolute inset-0 ${config.bgSoft} rounded-full animate-ping`} />
                            ) : null}
                            <div className={`w-16 h-16 ${config.bg} rounded-full flex items-center justify-center ${config.shadow}`}>
                                <Icon className="w-8 h-8 text-white stroke-[3]" />
                            </div>
                        </div>

                        {/* Text */}
                        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            {message}
                        </p>

                        {/* Button */}
                        <button
                            onClick={onClose}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                        >
                            حسناً
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
