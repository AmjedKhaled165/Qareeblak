"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lock, LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthGuardModalProps {
    open: boolean;
    onClose: () => void;
    onLogin: () => void;
}

export function AuthGuardModal({ open, onClose, onLogin }: AuthGuardModalProps) {
    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden text-center p-6"
                >
                    {/* Icon Bubble */}
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                        <Lock className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        يجب تسجيل الدخول
                    </h3>

                    <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                        عذراً، لا يمكنك إتمام هذا الإجراء بدون حساب.
                        <br />
                        سجل دخولك الآن واستمتع بكل خدماتنا! 🚀
                    </p>

                    <div className="space-y-3">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-11"
                            onClick={onLogin}
                        >
                            <LogIn className="w-5 h-5 ml-2" />
                            تسجيل الدخول / إنشاء حساب
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full text-slate-500 hover:text-slate-700"
                            onClick={onClose}
                        >
                            إلغاء
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
