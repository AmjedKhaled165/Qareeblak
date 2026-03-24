"use client";

import Link from "next/link";
import { Home, Search, User, UserCircle, Gift } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/components/providers/AppProvider";

export function MobileBottomNav() {
    const pathname = usePathname();
    const { currentUser } = useAppStore();

    // Hide on partner routes
    if (pathname?.startsWith('/partner')) return null;

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
            label: "حسابي",
            icon: currentUser ? UserCircle : User,
            href: currentUser ? "/profile" : "/login",
        },
        {
            label: "عجلة الحظ",
            icon: Gift,
            href: "/wheel",
        },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border px-6 py-3 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-all duration-300",
                            isActive ? "text-primary scale-110" : "text-muted-foreground"
                        )}
                    >
                        <item.icon className={cn("w-6 h-6", isActive && "fill-primary/10")} />
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
