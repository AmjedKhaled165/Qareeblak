"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Search, Bell, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [globalSearch, setGlobalSearch] = useState("");
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // ⚠️ TEMPORARY BYPASS: Skip auth check for development
        // TODO: Remove this after creating proper admin user
        const BYPASS_AUTH = true; // Set to false after login works
        
        if (BYPASS_AUTH) {
            setUser({
                id: 1,
                name: "Admin",
                name_ar: "المسؤول",
                email: "admin@test.com",
                user_type: "owner"
            });
            return;
        }
        
        const token = localStorage.getItem("qareeblak_token") || localStorage.getItem("halan_token");
        const stored = localStorage.getItem("user") || localStorage.getItem("halan_user");
        if (!token || !stored) {
            router.replace("/login");
            return;
        }
        try {
            const parsed = JSON.parse(stored);
            if (parsed.user_type !== "admin" && parsed.user_type !== "owner" && parsed.type !== "admin") {
                router.replace("/");
                return;
            }
            setUser(parsed);
        } catch {
            router.replace("/login");
        }
    }, [router]);

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950" dir="rtl">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <AdminSidebar currentPath={pathname} onNavigate={(path) => router.push(path)} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <div className="absolute inset-y-0 right-0 w-72">
                        <AdminSidebar
                            currentPath={pathname}
                            onNavigate={(path) => {
                                router.push(path);
                                setSidebarOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar */}
                <header className="h-16 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-6 shrink-0">
                    <button
                        title="فتح القائمة"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>

                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="بحث شامل... (طلبات، مستخدمين، منتجات)"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            className="pr-10 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button title="الإشعارات" className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </button>
                        <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                {user.name?.[0] || "A"}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">{user.name || "المسؤول"}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {user.user_type === "owner" ? "مالك النظام" : "مسؤول"}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
