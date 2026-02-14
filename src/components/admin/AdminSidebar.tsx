"use client";

import {
    LayoutDashboard,
    Package,
    Users,
    Store,
    MapPin,
    ScrollText,
    Settings,
    LogOut,
    ChevronDown,
    Shield,
    Truck,
    UserCog,
    ShoppingBag,
    FileText,

    Activity,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
    label: string;
    icon: React.ElementType;
    path?: string;
    badge?: number | string;
    badgeColor?: string;
    children?: { label: string; path: string; icon?: React.ElementType }[];
}

const navSections: { title: string; items: NavItem[] }[] = [
    {
        title: "لوحة التحكم",
        items: [
            { label: "نظرة عامة", icon: LayoutDashboard, path: "/admin" },
            { label: "النشاط المباشر", icon: Activity, path: "/admin/live", badge: "LIVE", badgeColor: "bg-green-500" },
        ],
    },
    {
        title: "العمليات",
        items: [
            {
                label: "📦 مركز العمليات",
                icon: Package,
                children: [
                    { label: "جميع الطلبات", path: "/admin/orders", icon: ShoppingBag },
                    { label: "طلبات التوصيل", path: "/admin/orders/delivery", icon: Truck },
                    { label: "طلبات الصيانة", path: "/admin/orders/maintenance", icon: Settings },
                ],
            },
            {
                label: "👥 إدارة المستخدمين",
                icon: Users,
                children: [
                    { label: "العملاء", path: "/admin/users/customers", icon: Users },
                    { label: "مقدمي الخدمات", path: "/admin/users/providers", icon: Store },
                    { label: "المناديب", path: "/admin/users/couriers", icon: Truck },
                    { label: "المسؤولين", path: "/admin/users/admins", icon: UserCog },
                ],
            },
        ],
    },
    {
        title: "الكتالوج",
        items: [
            {
                label: "🛠️ الخدمات والمنتجات",
                icon: Store,
                children: [
                    { label: "التصنيفات", path: "/admin/catalog/categories" },
                    { label: "المنتجات", path: "/admin/catalog/products" },
                    { label: "التسعير والعمولات", path: "/admin/catalog/pricing" },
                ],
            },
        ],
    },
    {
        title: "المراقبة",
        items: [
            { label: "🌍 التحكم الجغرافي", icon: MapPin, path: "/admin/zones" },
            { label: "👁️ سجل المراقبة", icon: ScrollText, path: "/admin/audit-log" },
            { label: "طلبات الانضمام", icon: FileText, path: "/admin/requests", badge: 3, badgeColor: "bg-red-500" },
        ],
    },
    {
        title: "النظام",
        items: [
            { label: "الإعدادات", icon: Settings, path: "/admin/settings" },
        ],
    },
];

interface AdminSidebarProps {
    currentPath: string;
    onNavigate: (path: string) => void;
}

export default function AdminSidebar({ currentPath, onNavigate }: AdminSidebarProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["📦 مركز العمليات", "👥 إدارة المستخدمين"]));

    const toggleSection = (label: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    const isActive = (path?: string) => path === currentPath;
    const isChildActive = (children?: { path: string }[]) =>
        children?.some((c) => currentPath.startsWith(c.path));

    const handleLogout = () => {
        localStorage.removeItem("qareeblak_token");
        localStorage.removeItem("halan_token");
        localStorage.removeItem("user");
        localStorage.removeItem("halan_user");
        window.location.href = "/login";
    };

    return (
        <aside className="w-64 h-screen flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
            {/* Logo / Brand */}
            <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-sm text-slate-800 dark:text-white font-cairo">لوحة المسؤول</h1>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">GOD MODE — v2.0</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                {navSections.map((section) => (
                    <div key={section.title}>
                        <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {section.title}
                        </p>
                        <div className="space-y-0.5">
                            {section.items.map((item) =>
                                item.children ? (
                                    /* Collapsible submenu */
                                    <div key={item.label}>
                                        <button
                                            onClick={() => toggleSection(item.label)}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all",
                                                isChildActive(item.children)
                                                    ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40"
                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            <item.icon className="w-4 h-4 shrink-0" />
                                            <span className="flex-1 text-right truncate">{item.label}</span>
                                            <ChevronDown
                                                className={cn(
                                                    "w-3.5 h-3.5 transition-transform",
                                                    expandedSections.has(item.label) && "rotate-180"
                                                )}
                                            />
                                        </button>
                                        {expandedSections.has(item.label) && (
                                            <div className="mr-4 mt-0.5 space-y-0.5 border-r-2 border-slate-200 dark:border-slate-700 pr-2">
                                                {item.children.map((child) => (
                                                    <button
                                                        key={child.path}
                                                        onClick={() => onNavigate(child.path)}
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                                            isActive(child.path)
                                                                ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 font-semibold"
                                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                        )}
                                                    >
                                                        {child.icon && <child.icon className="w-3.5 h-3.5 shrink-0" />}
                                                        <span>{child.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Simple link */
                                    <button
                                        key={item.label}
                                        onClick={() => item.path && onNavigate(item.path)}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all",
                                            isActive(item.path)
                                                ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 font-semibold"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4 shrink-0" />
                                        <span className="flex-1 text-right truncate">{item.label}</span>
                                        {item.badge !== undefined && (
                                            <span
                                                className={cn(
                                                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white",
                                                    item.badgeColor || "bg-slate-500"
                                                )}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                </button>
            </div>
        </aside>
    );
}
