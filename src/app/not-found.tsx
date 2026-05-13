import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Home } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-50 animate-pulse"></div>
                <h1 className="relative text-9xl font-black text-blue-600">404</h1>
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-4">
                عفواً.. الصفحة غير موجودة
            </h2>

            <p className="text-slate-500 max-w-md mb-8 text-lg">
                الرابط اللي دخلته ممكن يكون غلط أو الصفحة دي اتمسحت.
                ما تقلقش، كل الخدمات لسه موجودة في الرئيسية.
            </p>

            <Link href="/">
                <Button size="lg" className="gap-2 text-lg h-12 px-8">
                    <Home className="w-5 h-5" />
                    رجعني للصفحة الرئيسية
                </Button>
            </Link>
        </div>
    )
}
