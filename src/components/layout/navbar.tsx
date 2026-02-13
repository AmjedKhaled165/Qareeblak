"use client";

import Link from "next/link"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/components/providers/AppProvider"
import { UserCircle, LogOut, Menu, X, Home, Search, Briefcase, ShoppingCart } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { CartModal } from "@/components/features/cart-modal";
import { NotificationBell } from "@/components/features/notification-bell";

export function Navbar() {
    // Destructure logout directly from the hook - FIXING THE CRASH
    const { currentUser, logout, globalCart } = useAppStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [halanUser, setHalanUser] = useState<any>(null);
    const pathname = usePathname();

    useEffect(() => {
        // Check if there is a logged in Halan Partner
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            try {
                setHalanUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse halan user");
            }
        }
    }, []);

    // Hide Navbar on partner routes
    if (pathname?.startsWith('/partner')) {
        return null;
    }

    const handleLogout = () => {
        logout();
        window.location.reload();
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">

                {/* 1. Logo */}
                <div className="flex items-center gap-2">
                    <Link
                        href={currentUser?.type === 'provider' ? "/provider-dashboard" : "/"}
                        className="text-2xl font-bold text-primary tracking-tight"
                    >
                        قريبلك
                    </Link>
                </div>

                {/* 2. Desktop Navigation (Hidden on Mobile) */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    {currentUser?.type !== 'provider' && (
                        <>
                            <Link href="/" className="transition-colors hover:text-primary">الرئيسية</Link>
                            <Link href="/explore" className="transition-colors hover:text-primary">تصفح الخدمات</Link>
                        </>
                    )}
                    {currentUser?.type === 'provider' ? (
                        <Link href="/provider-dashboard" className="transition-colors text-primary font-bold">لوحة التحكم (Dashboard)</Link>
                    ) : (
                        <Link href="/track" className="transition-colors hover:text-primary">تتبع طلبك</Link>
                    )}
                </nav>

                {/* 3. User & Actions */}
                <div className="flex items-center gap-4">
                    <ThemeToggle />

                    {/* Notification Bell - visible for all logged in users */}
                    {currentUser && <NotificationBell />}

                    {/* Cart Trigger */}
                    {currentUser?.type !== 'provider' && (
                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="relative p-2 text-foreground hover:bg-accent rounded-full transition-colors group"
                            aria-label="سلة التسوق"
                        >
                            <ShoppingCart className="w-6 h-6" />
                            {globalCart.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-background group-hover:scale-110 transition-transform">
                                    {globalCart.length}
                                </span>
                            )}
                        </button>
                    )}

                    {/* User Menu (Desktop & Mobile) */}
                    {currentUser ? (
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-2 text-foreground font-bold bg-accent hover:bg-accent/80 transition-colors px-3 py-1.5 rounded-full border border-border"
                            >
                                <UserCircle className="w-5 h-5 text-primary" />
                                <span className="hidden sm:inline">{currentUser?.name?.split(" ")[0] || 'مستخدم'}</span>
                            </button>

                            {/* Dropdown with Click State */}
                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <>
                                        {/* Invisible Backdrop to close on outside click */}
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsUserMenuOpen(false)}
                                        />

                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute left-0 top-full mt-2 w-56 bg-card rounded-xl shadow-2xl border border-border overflow-hidden z-50"
                                        >
                                            <div className="p-2">
                                                <div className="px-3 py-3 text-xs text-muted-foreground font-semibold border-b border-border mb-1 bg-accent/50 rounded-t-lg">
                                                    <p className="text-foreground text-sm font-bold truncate">{currentUser.name}</p>
                                                    <p className="truncate font-normal mt-0.5">{currentUser.email}</p>
                                                </div>

                                                <Link
                                                    href="/profile"
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent rounded-lg transition-colors w-full font-medium"
                                                >
                                                    <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                                                        <UserCircle className="w-4 h-4" />
                                                    </div>
                                                    البروفايل
                                                </Link>

                                                {currentUser.type === 'provider' && (
                                                    <Link
                                                        href="/provider-dashboard"
                                                        onClick={() => setIsUserMenuOpen(false)}
                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors w-full font-bold"
                                                    >
                                                        <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                                                            <Briefcase className="w-4 h-4" />
                                                        </div>
                                                        لوحة التحكم
                                                    </Link>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        handleLogout();
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-medium mt-1"
                                                >
                                                    <div className="p-1.5 bg-destructive/10 text-destructive rounded-md">
                                                        <LogOut className="w-4 h-4" />
                                                    </div>
                                                    تسجيل الخروج
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : halanUser ? (
                        <Link href={halanUser.role === 'courier' ? '/partner/driver' : '/partner/dashboard'}>
                            <Button variant="outline" size="sm" className="hidden sm:flex border-primary/20 hover:bg-primary/5 text-primary">
                                <span className="ml-2">🚚</span>
                                لوحة التحكم
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/login">
                            <Button variant="ghost" size="sm" className="hidden sm:flex text-foreground">
                                تسجيل الدخول
                            </Button>
                        </Link>
                    )}

                    {/* Add Request (Hidden on very small screens if user name is long, generally visible) */}
                    {currentUser?.type !== 'provider' && (
                        <Link href="/explore">
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white shadow-md hidden sm:flex">
                                أضف طلبك
                            </Button>
                        </Link>
                    )}

                    {/* Mobile Menu Button - Visible on Mobile Only */}
                    {currentUser?.type !== 'provider' && (
                        <button
                            className="md:hidden p-2 text-foreground hover:bg-accent rounded-md"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t bg-background overflow-hidden"
                    >
                        <div className="p-4 space-y-4">
                            {currentUser?.type !== 'provider' && (
                                <>
                                    <Link href="/" className="flex items-center gap-3 text-foreground font-medium p-2 hover:bg-accent rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                                        <Home className="w-5 h-5 text-primary" />
                                        الرئيسية
                                    </Link>
                                    <Link href="/explore" className="flex items-center gap-3 text-foreground font-medium p-2 hover:bg-accent rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                                        <Search className="w-5 h-5 text-primary" />
                                        تصفح الخدمات
                                    </Link>
                                </>
                            )}

                            {currentUser?.type === 'provider' ? (
                                <Link href="/provider-dashboard" className="flex items-center gap-3 text-primary font-bold p-2 bg-primary/10 rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Briefcase className="w-5 h-5" />
                                    لوحة التحكم (Dashboard)
                                </Link>
                            ) : (
                                <Link href="/track" className="flex items-center gap-3 text-foreground font-medium p-2 hover:bg-accent rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Briefcase className="w-5 h-5 text-primary" />
                                    تتبع طلبك
                                </Link>
                            )}

                            {!currentUser && (
                                <Link href="/login" className="flex items-center gap-3 text-foreground font-medium p-2 hover:bg-accent rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                                    <UserCircle className="w-5 h-5 text-primary" />
                                    تسجيل الدخول
                                </Link>
                            )}

                            <Link href="/explore" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button className="w-full mt-2 bg-primary text-white">
                                    أضف طلبك
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />
        </header>
    )
}
