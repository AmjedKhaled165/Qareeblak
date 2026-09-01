"use client";

import Link from "next/link";
import { Home, Search, User, UserCircle, Gift, Package } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";

export function MobileBottomNav() {
    const pathname = usePathname();
    const { currentUser } = useAppStore();

    // Hide on partner routes and provider-dashboard (has its own mobile nav)
    if (pathname?.startsWith('/partner') || pathname?.startsWith('/provider-dashboard')) return null;

    const navItems = [
        {
            label: "الرئيسية",
            icon: Home,
            href: "/",
        },
        {
            label: "استكشف",
            icon: Search,
            href: "/explore",
        },
        {
            label: "تتبع",
            icon: Package,
            href: "/track",
        },
        {
            label: "الحظ",
            icon: Gift,
            href: "/wheel",
        },
        {
            label: "حسابي",
            icon: currentUser ? UserCircle : User,
            href: currentUser ? "/profile" : "/login",
        },
    ];

    return (
        <div
            className="md:hidden fixed bottom-4 left-4 right-4 z-50 px-2 py-2 flex justify-around items-center glass-premium rounded-[2.5rem] shadow-2xl border-white/10"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "relative flex flex-col items-center gap-1.5 py-2 px-4 transition-all duration-300",
                            isActive ? "text-white" : "text-slate-400"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="nav-bg"
                                className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-[1.5rem] -z-10 shadow-lg shadow-violet-500/40"
                                transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                            />
                        )}
                        <motion.div
                            animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.3 }}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                        </motion.div>
                        <span className={cn(
                            "text-[10px] font-black tracking-wider transition-opacity duration-300",
                            isActive ? "opacity-100" : "opacity-0 absolute"
                        )}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}


