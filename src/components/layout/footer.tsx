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
        <footer className="bg-card text-card-foreground py-12 mt-auto border-t border-border">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">

                {/* Brand & Bio */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground">خدمات أسيوط الجديدة</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        منصتك الأولى للوصول لكل الخدمات في أسيوط الجديدة. من السباكة للصيدليات، كل اللي تحتاجه في مكان واحد.
                    </p>
                </div>

                {/* Quick Links */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">روابط سريعة</h3>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link></li>
                        <li><Link href="/explore" className="hover:text-primary transition-colors">كل الخدمات</Link></li>
                        {currentUser?.type !== 'provider' && (
                            <li><Link href="/join" className="hover:text-primary transition-colors">انضم إلينا</Link></li>
                        )}
                    </ul>
                </div>

                {/* Contact */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">تواصل معنا</h3>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-primary" />
                            <span>info@assiut-services.com</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            <span>19XXX - 01000000000</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span>أسيوط الجديدة، الحي الثاني</span>
                        </li>
                    </ul>
                </div>

                {/* Legal & Social */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">قانوني</h3>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="#" className="hover:text-primary">سياسة الخصوصية</Link></li>
                        <li><Link href="#" className="hover:text-primary">شروط الاستخدام</Link></li>
                    </ul>
                    <div className="flex gap-4 pt-4">
                        <a href="#" aria-label="فيسبوك" className="hover:text-primary transition-colors"><Facebook className="h-5 w-5" /></a>
                        <a href="#" aria-label="تويتر" className="hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
                        <a href="#" aria-label="إنستغرام" className="hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground">
                © {new Date().getFullYear()} خدمات أسيوط الجديدة. جميع الحقوق محفوظة.
            </div>
        </footer>
    );
}
