"use client";

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/components/providers/AppProvider"
import { useCartStore } from "@/components/providers/CartProvider"
import { UserCircle, LogOut, Menu, X, Home, Search, Briefcase, ShoppingCart, Gift } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { CartModal } from "@/components/features/cart-modal";
import { NotificationBell } from "@/components/features/notification-bell";

export function Navbar() {
    // Destructure logout directly from the hook - FIXING THE CRASH
    const { currentUser, logout } = useAppStore();
    const { globalCart } = useCartStore();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [halanUser, setHalanUser] = useState<any>(null);
    const lastScrolledRef = useRef(false);
    const pathname = usePathname();

    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

    // Helper to determine the actual user type (fallback for different backends)
    const normalizedUserType = String(currentUser?.type || (currentUser as any)?.user_type || '').toLowerCase();
    const isProviderOrPartner = ['provider', 'partner', 'restaurant', 'pharmacy', 'maintenance', 'doctor', 'playground'].includes(normalizedUserType);
    const isProviderUser = normalizedUserType === 'provider';

    useEffect(() => {
        if (isProviderUser) {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');
            const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || '';
            if (token && currentUser?.email) {
                fetch(`${apiBase}/api/providers/by-email/${currentUser.email}`)
                .then(res => res.json())
                .then(profile => {
                    if (profile) {
                        if (profile.isOnline !== undefined) {
                            setIsOnline(profile.isOnline);
                        } else if (profile.is_online !== undefined) {
                            setIsOnline(profile.is_online);
                        }
                    }
                })
                .catch(err => console.error("Error fetching provider status", err));
            }
        }
    }, [currentUser, isProviderUser]);

    const handleStatusToggle = async () => {
        try {
            setIsTogglingStatus(true);
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('halan_token');
            const newStatus = !isOnline;
            const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || '';
            const res = await fetch(`${apiBase}/api/providers/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isOnline: newStatus })
            });
            if (res.ok) {
                setIsOnline(newStatus);
                // Dispatch a custom event to notify other components (like provider-dashboard)
                window.dispatchEvent(new CustomEvent('provider-status-changed', { detail: { isOnline: newStatus } }));
            }
        } catch (error) {
            console.error('Failed to toggle status:', error);
        } finally {
            setIsTogglingStatus(false);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const nextScrolled = currentScrollY > 20;
            
            // Hide on scroll down, show on scroll up
            if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }
            
            if (nextScrolled !== lastScrolledRef.current) {
                lastScrolledRef.current = nextScrolled;
                setScrolled(nextScrolled);
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        
        // Check if there is a logged in Halan Partner
        const storedUser = localStorage.getItem('halan_user');
        if (storedUser) {
            try {
                setHalanUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse halan user");
            }
        }
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        // Warm up key routes for near-instant navigation.
        router.prefetch('/');
        router.prefetch('/explore');
        router.prefetch('/track');
        router.prefetch('/wheel');
        router.prefetch('/login');
    }, [router]);

    // Hide Navbar on partner routes
    if (pathname?.startsWith('/partner')) {
        return null;
    }

    const handleLogout = () => {
        logout();
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
        router.push('/');
    };

    return (
        <header className={`sticky top-0 z-50 w-full transition-all duration-500 ${
            isVisible ? "translate-y-0" : "-translate-y-full"
        } ${
            scrolled 
            ? "border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg shadow-lg" 
            : "border-transparent bg-transparent py-1 sm:py-4"
        }`}>
            <div className={`w-full max-w-[1600px] mx-auto flex items-center justify-between px-4 sm:px-8 xl:px-12 transition-all duration-500 ${
                scrolled ? "h-14 sm:h-20" : "h-16 sm:h-24"
            }`}>

                {/* 1. Logo - Far Right */}
                <div className="flex flex-1 items-center justify-start shrink-0">
                    <Link
                        href={isProviderUser ? "/provider-dashboard" : "/"}
                        className="flex items-center gap-2 transition-transform hover:scale-105 group"
                    >
                        <div className={`relative flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-1 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:shadow-md transition-all duration-500 ${
                            scrolled ? "scale-90" : "scale-100 shadow-xl"
                        }`}>
                            <img 
                                src="/Qareeblak_Logo_rbg.png?v=20260327" 
                                alt="قريبلك" 
                                className="h-8 md:h-12 w-auto object-contain transition-all duration-500"
                            />
                        </div>
                        <span className={`font-black font-cairo bg-clip-text text-transparent bg-gradient-to-l from-indigo-700 to-violet-600 dark:from-indigo-400 dark:to-violet-400 tracking-tight hidden sm:inline transition-all duration-500 ${
                            scrolled ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                        }`}>
                            قريبلك
                        </span>
                    </Link>
                </div>

                {/* 2. Desktop Navigation - Center */}
                {!(pathname.startsWith('/provider-dashboard') || pathname.startsWith('/partner') || pathname.startsWith('/admin') || isProviderOrPartner) && (
                    <nav className="hidden md:flex shrink-0 justify-center items-center gap-6 lg:gap-8 text-[15px] font-bold font-cairo">
                        {[
                            { label: 'الرئيسية', href: '/' },
                            { label: 'تصفح الخدمات', href: '/explore' },
                            { label: 'تتبع طلبك', href: '/track' }
                        ].map((item) => (
                            <Link 
                                key={item.href}
                                href={item.href} 
                                className={`relative text-slate-600 dark:text-slate-300 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 after:content-[''] after:absolute after:bottom-[-4px] after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full ${
                                    pathname === item.href ? "text-primary dark:text-primary after:w-full" : ""
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link href="/wheel" className="transition-all text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 px-4 py-2 rounded-2xl border border-orange-200 dark:border-orange-500/20 shadow-sm hover:shadow-md group">
                            <Gift className="w-4 h-4 group-hover:rotate-12 transition-transform" /> 
                            <span>عجلة الحظ</span>
                        </Link>
                    </nav>
                )}

                {/* 3. User & Actions - Far Left */}
                <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-4">
                    <ThemeToggle />

                    {/* Provider Online Toggle */}
                    {isProviderUser && (
                        <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                            <span className={`text-xs font-bold ${isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>{isOnline ? 'متصل' : 'مخفي'}</span>
                            <button
                                onClick={handleStatusToggle}
                                disabled={isTogglingStatus}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'} ${isTogglingStatus ? 'opacity-50' : ''}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isOnline ? '-translate-x-5' : '-translate-x-1'}`} />
                            </button>
                        </div>
                    )}

                    {/* Notification Bell - visible for all logged in users */}
                    {currentUser && <div className="pop-hover"><NotificationBell /></div>}

                    {/* Cart Trigger */}
                    {!(pathname.startsWith('/provider-dashboard') || pathname.startsWith('/partner') || pathname.startsWith('/admin') || isProviderOrPartner) && (
                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="relative p-2.5 text-foreground hover:bg-accent rounded-full transition-colors group pop-hover"
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
                                className="flex items-center gap-2 text-foreground font-bold bg-white/50 dark:bg-slate-900/50 backdrop-blur-md hover:bg-accent transition-colors px-4 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm"
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
                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                            className="absolute left-0 top-full mt-3 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden z-50"
                                        >
                                            <div className="p-2.5">
                                                <div className="px-4 py-4 text-xs text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800 mb-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                                                    <p className="text-slate-900 dark:text-white text-base font-black truncate font-cairo">{currentUser.name}</p>
                                                    <p className="truncate font-medium mt-0.5 opacity-70">{currentUser.email}</p>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        handleLogout();
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors font-bold font-cairo"
                                                >
                                                    <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
                                                        <LogOut className="w-5 h-5" />
                                                    </div>
                                                    تسجيل الخروج
                                                </button>

                                                <Link
                                                    href="/profile"
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors w-full font-bold font-cairo"
                                                >
                                                    <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                        <UserCircle className="w-5 h-5" />
                                                    </div>
                                                    إعدادات الحساب
                                                </Link>

                                                {isProviderOrPartner && (
                                                    <Link
                                                        href="/provider-dashboard"
                                                        onClick={() => setIsUserMenuOpen(false)}
                                                        className="flex items-center gap-3 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors w-full font-black font-cairo"
                                                    >
                                                        <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                                                            <Briefcase className="w-5 h-5" />
                                                        </div>
                                                        لوحة التحكم
                                                    </Link>
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <Link href="/login">
                            <Button variant="ghost" size="sm" className="hidden sm:flex text-slate-700 dark:text-slate-200 font-bold font-cairo hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                                تسجيل الدخول
                            </Button>
                        </Link>
                    )}



                    {/* Provider Online Toggle (Mobile) */}
                    {isProviderUser && (
                        <div className="md:hidden flex items-center gap-1.5 mr-1 bg-slate-100 dark:bg-slate-800/50 px-2 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={handleStatusToggle}
                                disabled={isTogglingStatus}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'} ${isTogglingStatus ? 'opacity-50' : ''}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isOnline ? '-translate-x-5' : '-translate-x-1'}`} />
                            </button>
                        </div>
                    )}

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden shrink-0 rounded-2xl p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Menu - Enhanced Staggered Reveal */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="md:hidden w-full overflow-hidden border-t border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg shadow-2xl"
                    >
                        <div className="space-y-2.5 p-6">
                            {(!(pathname.startsWith('/provider-dashboard') || pathname.startsWith('/partner') || pathname.startsWith('/admin') || isProviderOrPartner) ? [
                                { label: 'الرئيسية', href: '/', icon: Home },
                                { label: 'تصفح الخدمات', href: '/explore', icon: Search },
                                ...(!currentUser ? [{ label: 'تسجيل الدخول', href: '/login', icon: UserCircle }] : []),
                                { label: 'عجلة الحظ', href: '/wheel', icon: Gift, highlight: true },
                                { label: 'تتبع طلبك', href: '/track', icon: Briefcase }
                            ] : []).map((item, i) => (
                                <motion.div
                                    key={item.href}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Link 
                                        href={item.href} 
                                        className={`flex items-center gap-4 p-4 rounded-2xl font-bold font-cairo transition-all active:scale-[0.98] ${
                                            item.highlight 
                                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" 
                                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        }`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <div className={`p-2 rounded-xl ${item.highlight ? "bg-orange-500/20" : "bg-indigo-500/10"}`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-lg">{item.label}</span>
                                    </Link>
                                </motion.div>
                            ))}


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
