import Link from "next/link"
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flexmin-h-screen bg-slate-50">
            <div className="flex">
                {/* Sidebar */}
                <aside className="hidden w-64 border-l bg-white min-h-[calc(100vh-64px)] md:block sticky top-16">
                    <div className="flex h-14 items-center border-b px-4">
                        <span className="font-bold text-lg">لوحة التحكم</span>
                    </div>
                    <div className="p-4 space-y-2">
                        <Link href="/admin" className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-slate-900 transition-all hover:text-slate-900">
                            <LayoutDashboard className="h-4 w-4" />
                            الرئيسية
                        </Link>
                        <Link href="/admin/requests" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:text-slate-900 hover:bg-slate-50">
                            <Users className="h-4 w-4" />
                            طلبات الانضمام
                            <span className="mr-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                                3
                            </span>
                        </Link>
                        <Link href="/admin/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:text-slate-900 hover:bg-slate-50">
                            <Settings className="h-4 w-4" />
                            الإعدادات
                        </Link>

                        <div className="pt-4 mt-auto">
                            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-500 transition-all hover:bg-red-50">
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
