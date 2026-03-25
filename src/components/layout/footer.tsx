"use client";

import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

import { usePathname } from "next/navigation";
import { useAppStore } from "@/components/providers/AppProvider";
import { SocialIcons3D } from "@/components/shared/SocialIcons3D";

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
                    {/* 3D Social Icons */}
                    <div className="pt-2">
                        <SocialIcons3D />
                    </div>
                </div>

                {/* Quick Links */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">روابط سريعة</h3>
                    <ul className="space-y-3 font-medium text-slate-400">
                        <li><Link href="/" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200 link-hover">الرئيسية</Link></li>
                        <li><Link href="/explore" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200 link-hover">كل الخدمات</Link></li>
                        {currentUser?.type !== 'provider' && (
                            <li><Link href="/join" className="hover:text-primary transition-colors inline-block hover:translate-x-[-4px] duration-200 link-hover">سجل نشاطك مجاناً</Link></li>
                        )}
                        <li><Link href="/wheel" className="hover:text-orange-400 text-orange-500 transition-colors inline-block hover:translate-x-[-4px] duration-200 link-hover">عجلة الحظ 🎁</Link></li>
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
                            <a
                                href="mailto:qareeblak@qareeblak.com"
                                className="hover:text-primary transition-colors"
                            >
                                qareeblak@qareeblak.com
                            </a>
                        </li>
                        <li className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <a
                                href="https://wa.me/201515928278"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-green-400 transition-colors flex items-center gap-2"
                            >
                                <svg
                                    className="w-4 h-4 text-green-400 shrink-0"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-label="WhatsApp"
                                >
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                </svg>
                                01515928278
                            </a>
                        </li>
                        <li className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <span>أسيوط الجديدة</span>
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
