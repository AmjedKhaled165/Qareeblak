"use client";

import Link from "next/link";
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from "lucide-react";

import { usePathname } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";

export function Footer() {
    const pathname = usePathname();
    const { currentUser } = useAppStore();

    // Hide Footer on dashboard routes
    if (pathname?.startsWith('/partner') || pathname?.startsWith('/provider-dashboard')) {
        return null;
    }

    return (
        <footer className="bg-slate-900 dark:bg-slate-950 text-slate-300 py-16 mt-auto border-t border-slate-800 relative overflow-hidden font-cairo">
            {/* Background elements */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="container max-w-7xl mx-auto px-4 lg:px-8 relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">

                {/* Brand & Bio (Spans 4 columns on large screens) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-xl shadow-lg">
                            <img 
                                src="/Qareeblak_Logo_rbg.png?v=20260321" 
                                alt="قريبلك" 
                                className="w-10 h-10 object-contain"
                            />
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight">قريبلك</h3>
                    </div>
                    <p className="text-base text-slate-400 leading-relaxed font-medium">
                        المنصة الأولى لربط سكان أسيوط الجديدة بأفضل مقدمي الخدمات والمتاجر والمطاعم الموثوقة. دليلك الشامل الذكي بين إيديك.
                    </p>
                    <div className="flex gap-4 pt-2">
                        <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-primary transition-colors text-white rounded-full flex items-center justify-center shadow-lg"><Facebook className="h-4 w-4" /></a>
                        <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-primary transition-colors text-white rounded-full flex items-center justify-center shadow-lg"><Twitter className="h-4 w-4" /></a>
                        <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-primary transition-colors text-white rounded-full flex items-center justify-center shadow-lg"><Instagram className="h-4 w-4" /></a>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">روابط سريعة</h3>
                    <ul className="space-y-3 font-medium text-slate-400">
                        <li><Link href="/" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200">الرئيسية</Link></li>
                        <li><Link href="/explore" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200">كل الخدمات</Link></li>
                        {currentUser?.type !== 'provider' && (
                            <li><Link href="/join" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200">سجل نشاطك مجاناً</Link></li>
                        )}
                        <li><Link href="/wheel" className="hover:text-orange-400 text-orange-500 transition-colors inline-block hover:translate-x-[-4px] duration-200">عجلة الحظ 🎁</Link></li>
                    </ul>
                </div>

                {/* Categories */}
                <div className="lg:col-span-3 space-y-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">أهم الأقسام</h3>
                    <ul className="space-y-3 font-medium text-slate-400 grid grid-cols-2 lg:grid-cols-1">
                        <li><Link href="/explore?q=مطعم" className="hover:text-primary transition-colors">مطاعم وكافيهات</Link></li>
                        <li><Link href="/explore?q=صيانة" className="hover:text-primary transition-colors">صيانة وسباكة</Link></li>
                        <li><Link href="/explore?q=سوبر" className="hover:text-primary transition-colors">سوبر ماركت</Link></li>
                        <li><Link href="/explore?q=صيدلية" className="hover:text-primary transition-colors">صيدليات</Link></li>
                    </ul>
                </div>

                {/* Contact */}
                <div className="lg:col-span-3 space-y-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">تواصل معنا</h3>
                    <ul className="space-y-4 font-medium text-slate-400">
                        <li className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <span>support@qareeblak.com</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <span>19XXX - 01000000000</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <span>أسيوط الجديدة، الحي الثاني، أمام الميدان الرئيسي</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-4 lg:px-8 mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-medium text-slate-500">
                <div className="flex gap-6">
                    <Link href="/privacy" className="hover:text-slate-300 transition-colors">سياسة الخصوصية</Link>
                    <Link href="/terms" className="hover:text-slate-300 transition-colors">شروط الاستخدام</Link>
                </div>
                <div className="text-center md:text-left">
                    © {new Date().getFullYear()} منصة قريبلك لخدمات أسيوط الجديدة. جميع الحقوق محفوظة.
                </div>
            </div>
        </footer>
    );
}
