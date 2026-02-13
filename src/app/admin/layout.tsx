import Link from "next/link"
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <div className="flex w-full">
                {/* Sidebar */}
                <aside className="hidden w-64 border-l border-border/50 bg-card min-h-[calc(100vh-64px)] md:block sticky top-16">
                    <div className="flex h-14 items-center border-b border-border/50 px-4">
                        <span className="font-bold text-lg font-cairo">لوحة التحكم</span>
                    </div>
                    <div className="p-4 space-y-2">
                        <Link href="/admin" className="flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2 text-primary transition-all hover:bg-primary/20">
                            <LayoutDashboard className="h-4 w-4" />
                            الرئيسية
                        </Link>
                        <Link href="/admin/requests" className="flex items-center gap-3 rounded-xl px-3 py-2 text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50">
                            <Users className="h-4 w-4" />
                            طلبات الانضمام
                            <span className="mr-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive/20 text-xs font-bold text-destructive">
                                3
                            </span>
                        </Link>
                        <Link href="/admin/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50">
                            <Settings className="h-4 w-4" />
                            الإعدادات
                        </Link>

                        <div className="pt-4 mt-auto">
                            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-destructive transition-all hover:bg-destructive/10 hover:font-bold">
                                <LogOut className="h-4 w-4" />
                                تسجيل الخروج
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
