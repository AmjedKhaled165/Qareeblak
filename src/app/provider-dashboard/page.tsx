"use client";

import { useAppStore } from "@/hooks/use-app-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { LayoutDashboard, ShoppingBag, Star, TrendingUp, Settings, LogOut, Utensils, Plus, Trash2, Edit, Check, X, Clock, Camera, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/providers/toast-provider";
import { useConfirm } from "@/providers/confirm-provider";

// Type definitions
interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    hasOffer?: boolean;
    offerType?: "discount" | "bundle";
    discountPercent?: number;
    bundleCount?: number;
    bundleFreeCount?: number;
    offerEndDate?: string;
}

interface Review {
    id: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
}

interface Provider {
    id: string;
    name: string;
    email?: string; // Optional here as we might not know it for others
    services: Service[];
    reviewsList?: Review[];
    rating?: number;
}

interface Booking {
    id: string;
    userName: string;
    serviceName: string;
    providerName: string;
    providerId?: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
    date?: string;
    details?: string;
}

export default function ProviderDashboard() {
    const { currentUser, bookings, providers, logout, isInitialized, manageService, updateBookingStatus } = useAppStore();
    const router = useRouter();
    const { toast } = useToast();
    const { confirm } = useConfirm();

    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'services' | 'reviews'>('overview');

    // Service Form State
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [serviceForm, setServiceForm] = useState({
        name: "",
        description: "",
        price: "",
        image: "",
        hasOffer: false,
        offerType: "discount" as "discount" | "bundle",
        discountPercent: "",
        bundleCount: "",
        bundleFreeCount: "",
        offerEndDate: ""
    });

    const resetServiceForm = () => setServiceForm({
        name: "",
        description: "",
        price: "",
        image: "",
        hasOffer: false,
        offerType: "discount",
        discountPercent: "",
        bundleCount: "",
        bundleFreeCount: "",
        offerEndDate: ""
    });

    // Camera State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null); // Preview before confirming
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const openCamera = async () => {
        try {
            setCapturedPreview(null);
            setIsCameraReady(false);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setCameraStream(stream);
            setIsCameraOpen(true);

            // Wait for next render then attach stream
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                        setIsCameraReady(true);
                    };
                }
            }, 200);
        } catch (err) {
            console.error("Camera error:", err);
            toast("تعذر الوصول للكاميرا. تأكد من الأذونات.", "error");
        }
    };

    const capturePhoto = () => {
        alert("capturePhoto START - modal will stay open!");
        try {
            if (!videoRef.current || !canvasRef.current) {
                toast("خطأ: لم يتم العثور على الكاميرا", "error");
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;

            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = canvas.toDataURL('image/jpeg', 0.85);

                console.log("Setting preview:", imageData.substring(0, 50));

                // Save to preview (not form yet)
                setCapturedPreview(imageData);

                // Show confirmation
                toast("تم التقاط الصورة! اضغط استمر للحفظ ✅", "success");

                // Stop camera stream while previewing
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }
            } else {
                toast("خطأ في الكاميرا", "error");
            }
        } catch (error) {
            console.error("Capture error:", error);
            toast("خطأ في التقاط الصورة", "error");
        }
    };

    const confirmPhoto = () => {
        if (capturedPreview) {
            setServiceForm(prev => ({ ...prev, image: capturedPreview }));
            toast("تم حفظ الصورة بنجاح! ✅", "success");
            setCapturedPreview(null);
            setCameraStream(null);
            setIsCameraReady(false);
            setIsCameraOpen(false);
        }
    };

    const retakePhoto = async () => {
        setCapturedPreview(null);
        // Restart camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setCameraStream(stream);
            setIsCameraReady(false);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                        setIsCameraReady(true);
                    };
                }
            }, 200);
        } catch (err) {
            toast("تعذر إعادة تشغيل الكاميرا", "error");
        }
    };

    const closeCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCapturedPreview(null);
        setIsCameraReady(false);
        setIsCameraOpen(false);
    };

    // Authentication Guard
    if (!isInitialized) {
        return <div className="min-h-screen flex items-center justify-center bg-orange-50 text-orange-600">جاري التحميل...</div>;
    }

    if (!currentUser || currentUser.type !== 'provider') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full shadow-lg text-center p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogOut className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">وصول غير مصرح به</h2>
                    <p className="text-slate-500 mb-6">
                        عذراً، هذه الصفحة مخصصة لشركاء الخدمة فقط. يرجى تسجيل الدخول بحساب شريك معتمد.
                    </p>
                    <Button
                        className="w-full bg-slate-900 hover:bg-slate-800"
                        onClick={() => {
                            if (currentUser) logout();
                            router.push('/login/provider');
                        }}
                    >
                        تسجيل الدخول كشريك
                    </Button>
                </Card>
            </div>
        );
    }

    // Identifiers
    const myProviderProfile = providers.find((p: Provider) => (p.email && p.email === currentUser.email) || p.name === currentUser.name);
    const providerId = myProviderProfile?.id;
    const myBookings = bookings.filter((b: Booking) => b.providerName === currentUser.name || (myProviderProfile && b.providerId === myProviderProfile.id));
    const myServices = myProviderProfile?.services || [];
    const myReviews = myProviderProfile?.reviewsList || [];

    // --- Actions ---

    const handleSaveService = async () => {
        if (!serviceForm.name || !serviceForm.price) return;

        if (!providerId) {
            toast("عذراً، لم يتم العثور على حساب مقدم الخدمة الخاص بك. يرجى تسجيل الخروج والدخول مرة أخرى.", "error");
            return;
        }

        const serviceData: any = {
            name: serviceForm.name,
            description: serviceForm.description,
            price: Number(serviceForm.price),
            image: serviceForm.image || undefined
        };

        // Build offer object if enabled
        if (serviceForm.hasOffer) {
            serviceData.offer = {
                type: serviceForm.offerType,
                endDate: serviceForm.offerEndDate || undefined
            };
            if (serviceForm.offerType === 'discount') {
                serviceData.offer.discountPercent = Number(serviceForm.discountPercent) || 0;
            } else {
                serviceData.offer.bundleCount = Number(serviceForm.bundleCount) || 0;
                serviceData.offer.bundleFreeCount = Number(serviceForm.bundleFreeCount) || 1;
            }
        }

        try {
            if (editingServiceId) {
                await manageService(providerId, 'update', { id: editingServiceId, ...serviceData });
                toast("تم تعديل الخدمة بنجاح", "success");
            } else {
                await manageService(providerId, 'add', serviceData);
                toast("تم إضافة الخدمة بنجاح", "success");
            }
            setIsServiceModalOpen(false);
            resetServiceForm();
            setEditingServiceId(null);
        } catch (error) {
            toast("حدث خطأ في حفظ الخدمة", "error");
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!providerId) return;

        const confirmed = await confirm({
            title: 'حذف الخدمة',
            message: 'هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع.',
            confirmText: 'نعم، احذف',
            cancelText: 'إلغاء',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await manageService(providerId, 'delete', { id });
                toast("تم حذف الخدمة", "info");
            } catch (error) {
                toast("حدث خطأ في حذف الخدمة", "error");
            }
        }
    };

    const handleEditService = (service: any) => {
        setServiceForm({
            name: service.name,
            description: service.description || "",
            price: service.price.toString(),
            image: service.image || "",
            hasOffer: !!service.offer,
            offerType: service.offer?.type || "discount",
            discountPercent: service.offer?.discountPercent?.toString() || "",
            bundleCount: service.offer?.bundleCount?.toString() || "",
            bundleFreeCount: service.offer?.bundleFreeCount?.toString() || "",
            offerEndDate: service.offer?.endDate || ""
        });
        setEditingServiceId(service.id);
        setIsServiceModalOpen(true);
    };

    const handleOrderStatus = async (bookingId: string, status: 'confirmed' | 'completed' | 'rejected') => {
        try {
            await updateBookingStatus(bookingId, status);
            toast(`تم تحديث حالة الطلب إلى: ${status === 'confirmed' ? 'جاري التنفيذ' : status === 'completed' ? 'مكتمل' : 'مرفوض'}`, "success");
        } catch (error) {
            toast("حدث خطأ في تحديث الطلب", "error");
        }
    };


    return (
        <>
            <div className="min-h-screen bg-slate-50 dir-rtl flex">

                {/* Sidebar (Desktop) */}
                <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col fixed h-full right-0 z-10">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <LayoutDashboard className="text-orange-500" />
                            لوحة الشركاء
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">مرحباً، {currentUser.name}</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        <Button
                            variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
                            className={`w-full justify-start gap-3 ${activeTab === 'overview' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            نظرة عامة
                        </Button>
                        <Button
                            variant={activeTab === 'orders' ? 'secondary' : 'ghost'}
                            className={`w-full justify-start gap-3 ${activeTab === 'orders' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('orders')}
                        >
                            <ShoppingBag className="w-5 h-5" />
                            الطلبات ({myBookings.filter((b: Booking) => b.status === 'pending').length})
                        </Button>
                        <Button
                            variant={activeTab === 'services' ? 'secondary' : 'ghost'}
                            className={`w-full justify-start gap-3 ${activeTab === 'services' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('services')}
                        >
                            <Utensils className="w-5 h-5" />
                            المنيو / الخدمات
                        </Button>
                        <Button
                            variant={activeTab === 'reviews' ? 'secondary' : 'ghost'}
                            className={`w-full justify-start gap-3 ${activeTab === 'reviews' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            onClick={() => setActiveTab('reviews')}
                        >
                            <Star className="w-5 h-5" />
                            التقييمات
                        </Button>
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <Button
                            variant="destructive"
                            className="w-full justify-start gap-3"
                            onClick={() => { logout(); router.push('/login/provider'); }}
                        >
                            <LogOut className="w-4 h-4" />
                            تسجيل الخروج
                        </Button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 md:p-8 md:mr-64 transition-all w-full">
                    <div className="max-w-5xl mx-auto space-y-8">

                        {/* Header Mobile */}
                        <div className="md:hidden flex items-center justify-between mb-6">
                            <h1 className="text-2xl font-bold text-slate-900">لوحة الشركاء</h1>
                            <Button size="sm" variant="ghost" onClick={() => logout()}>خروج</Button>
                        </div>

                        {/* TABS CONTENT */}

                        {/* 1. OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardContent className="p-6 flex items-center gap-4">
                                            <div className="p-4 bg-orange-100 rounded-full text-orange-600">
                                                <ShoppingBag className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">الطلبات الجديدة</p>
                                                <h3 className="text-3xl font-bold text-slate-900">{myBookings.filter((b: Booking) => b.status === 'pending').length}</h3>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="p-6 flex items-center gap-4">
                                            <div className="p-4 bg-green-100 rounded-full text-green-600">
                                                <TrendingUp className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">إجمالي المبيعات (مقدرة)</p>
                                                <h3 className="text-3xl font-bold text-slate-900">{myBookings.filter((b: Booking) => b.status === 'completed').length * 150} ج.م</h3>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="p-6 flex items-center gap-4">
                                            <div className="p-4 bg-yellow-100 rounded-full text-yellow-600">
                                                <Star className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">التقييم العام</p>
                                                <h3 className="text-3xl font-bold text-slate-900">
                                                    {myReviews.length > 0
                                                        ? (myReviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / myReviews.length).toFixed(1)
                                                        : '0'
                                                    }
                                                </h3>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="border-none shadow-md">
                                    <CardHeader>
                                        <CardTitle>آخر 5 طلبات</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Simplified Table for overview */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-right">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-3">العميل</th>
                                                        <th className="px-4 py-3">الخدمة</th>
                                                        <th className="px-4 py-3">الحالة</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {myBookings.slice(0, 5).map((booking: Booking, i: number) => (
                                                        <tr key={i}>
                                                            <td className="px-4 py-3 font-semibold">{booking.userName}</td>
                                                            <td className="px-4 py-3">{booking.serviceName}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${booking.status === 'pending' ? 'bg-orange-100 text-orange-700' : booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                                                                    {booking.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {myBookings.length === 0 && (
                                                        <tr><td colSpan={3} className="text-center py-4 text-slate-400">لا توجد طلبات بعد</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* 2. SERVICES TAB */}
                        {activeTab === 'services' && (
                            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-slate-900">الخدمات / المنيو</h2>
                                    <Dialog open={isServiceModalOpen} onOpenChange={(open: boolean) => {
                                        // Only allow opening, prevent auto-close
                                        if (open) setIsServiceModalOpen(true);
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button
                                                onClick={() => { resetServiceForm(); setEditingServiceId(null); }}
                                                className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> إضافة خدمة
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent
                                            className="max-w-lg max-h-[90vh] overflow-y-auto"
                                            onInteractOutside={(e: Event) => e.preventDefault()}
                                            onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
                                        >
                                            <DialogHeader className="flex flex-row items-center justify-between">
                                                <DialogTitle>{editingServiceId ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsServiceModalOpen(false)}
                                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                {/* اسم الخدمة - إجباري */}
                                                <div className="space-y-2">
                                                    <Label>اسم الخدمة / الأكلة <span className="text-red-500">*</span></Label>
                                                    <Input value={serviceForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="مثال: بيتزا مشكل جبن" />
                                                </div>

                                                {/* الوصف - اختياري */}
                                                <div className="space-y-2">
                                                    <Label>الوصف <span className="text-slate-400 text-xs">(اختياري)</span></Label>
                                                    <Input value={serviceForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="مكونات أو تفاصيل الخدمة" />
                                                </div>

                                                {/* صورة - اختياري */}
                                                <div className="space-y-2">
                                                    <Label>صورة الخدمة <span className="text-slate-400 text-xs">(اختياري)</span></Label>

                                                    {/* Image Preview */}
                                                    {serviceForm.image && (
                                                        <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-slate-100">
                                                            <img src={serviceForm.image} alt="معاينة" className="w-full h-full object-cover" />
                                                            <button
                                                                type="button"
                                                                onClick={() => setServiceForm({ ...serviceForm, image: "" })}
                                                                className="absolute top-2 left-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Upload Buttons */}
                                                    {!serviceForm.image && (
                                                        <div className="flex gap-2">
                                                            {/* اختيار من الجهاز */}
                                                            <label className="flex-1 cursor-pointer">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => {
                                                                                setServiceForm({ ...serviceForm, image: reader.result as string });
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors">
                                                                    <Plus className="w-5 h-5 text-slate-500" />
                                                                    <span className="text-sm text-slate-600">اختر صورة</span>
                                                                </div>
                                                            </label>

                                                            {/* التقاط من الكاميرا */}
                                                            <button
                                                                type="button"
                                                                onClick={openCamera}
                                                                className="cursor-pointer"
                                                            >
                                                                <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors">
                                                                    <Camera className="w-5 h-5 text-slate-500" />
                                                                    <span className="text-sm text-slate-600">الكاميرا</span>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* السعر - إجباري */}
                                                <div className="space-y-2">
                                                    <Label>السعر (ج.م) <span className="text-red-500">*</span></Label>
                                                    <Input type="number" value={serviceForm.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, price: e.target.value })} placeholder="0" />
                                                </div>

                                                {/* العرض - اختياري */}
                                                <div className="border-t pt-4 mt-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <input
                                                            type="checkbox"
                                                            id="hasOffer"
                                                            checked={serviceForm.hasOffer}
                                                            onChange={(e) => setServiceForm({ ...serviceForm, hasOffer: e.target.checked })}
                                                            className="w-4 h-4 accent-orange-600"
                                                        />
                                                        <Label htmlFor="hasOffer" className="cursor-pointer">إضافة عرض ترويجي</Label>
                                                    </div>

                                                    {serviceForm.hasOffer && (
                                                        <div className="bg-orange-50 p-4 rounded-lg space-y-4 border border-orange-200">
                                                            {/* نوع العرض */}
                                                            <div className="space-y-2">
                                                                <Label>نوع العرض</Label>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={serviceForm.offerType === 'discount' ? 'default' : 'outline'}
                                                                        className={serviceForm.offerType === 'discount' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                                                                        onClick={() => setServiceForm({ ...serviceForm, offerType: 'discount' })}
                                                                    >
                                                                        خصم نسبة %
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={serviceForm.offerType === 'bundle' ? 'default' : 'outline'}
                                                                        className={serviceForm.offerType === 'bundle' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                                                                        onClick={() => setServiceForm({ ...serviceForm, offerType: 'bundle' })}
                                                                    >
                                                                        اشتري X واحصل على Y
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* تفاصيل الخصم */}
                                                            {serviceForm.offerType === 'discount' && (
                                                                <div className="space-y-2">
                                                                    <Label>نسبة الخصم %</Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="number"
                                                                            value={serviceForm.discountPercent}
                                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, discountPercent: e.target.value })}
                                                                            placeholder="10"
                                                                            className="w-24"
                                                                            min="1"
                                                                            max="100"
                                                                        />
                                                                        <span className="text-slate-600 font-bold">%</span>
                                                                        {serviceForm.discountPercent && serviceForm.price && (
                                                                            <span className="text-green-600 text-sm">
                                                                                = {Math.round(Number(serviceForm.price) * (1 - Number(serviceForm.discountPercent) / 100))} ج.م
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* تفاصيل Bundle */}
                                                            {serviceForm.offerType === 'bundle' && (
                                                                <div className="space-y-2">
                                                                    <Label>اشتري كم واحصل على كم مجاناً؟</Label>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span>اشتري</span>
                                                                        <Input
                                                                            type="number"
                                                                            value={serviceForm.bundleCount}
                                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleCount: e.target.value })}
                                                                            placeholder="3"
                                                                            className="w-16"
                                                                            min="1"
                                                                        />
                                                                        <span>واحصل على</span>
                                                                        <Input
                                                                            type="number"
                                                                            value={serviceForm.bundleFreeCount}
                                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleFreeCount: e.target.value })}
                                                                            placeholder="1"
                                                                            className="w-16"
                                                                            min="1"
                                                                        />
                                                                        <span>مجاناً</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* تاريخ انتهاء العرض */}
                                                            <div className="space-y-2">
                                                                <Label>تاريخ انتهاء العرض <span className="text-slate-400 text-xs">(اختياري)</span></Label>
                                                                <Input
                                                                    type="date"
                                                                    value={serviceForm.offerEndDate}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, offerEndDate: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleSaveService} className="bg-orange-600 hover:bg-orange-700">حفظ</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {myServices.map((service: any) => (
                                        <Card key={service.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
                                            {/* صورة الخدمة */}
                                            {service.image && (
                                                <div className="h-32 w-full overflow-hidden bg-slate-100">
                                                    <img src={service.image} alt={service.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                </div>
                                            )}

                                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg">{service.name}</CardTitle>
                                                    <CardDescription className="line-clamp-2 mt-1">{service.description}</CardDescription>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {service.offer ? (
                                                        <>
                                                            <span className="line-through text-slate-400 text-xs">{service.price} ج.م</span>
                                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-bold">
                                                                {service.offer.type === 'discount'
                                                                    ? `${Math.round(service.price * (1 - (service.offer.discountPercent || 0) / 100))} ج.م`
                                                                    : `${service.price} ج.م`
                                                                }
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="bg-slate-100 px-2 py-1 rounded text-sm font-bold text-slate-700">
                                                            {service.price} ج.م
                                                        </span>
                                                    )}
                                                </div>
                                            </CardHeader>

                                            {/* شارة العرض */}
                                            {service.offer && (
                                                <div className="px-4 pb-2">
                                                    <div className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                                                        🎁 {service.offer.type === 'discount'
                                                            ? `خصم ${service.offer.discountPercent}%`
                                                            : `اشتري ${service.offer.bundleCount} واحصل على ${service.offer.bundleFreeCount} مجاناً`
                                                        }
                                                        {service.offer.endDate && (
                                                            <span className="text-orange-500 mr-2">• حتى {service.offer.endDate}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <CardContent>
                                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                                    <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => handleEditService(service)}>
                                                        <Edit className="w-4 h-4" /> تعديل
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="px-3" onClick={() => handleDeleteService(service.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {myServices.length === 0 && (
                                        <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed text-slate-400">
                                            <p>لا يوجد خدمات مضافة حالياً. ابدأ بإضافة خدماتك ليراها العملاء!</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* 3. ORDERS TAB */}
                        {activeTab === 'orders' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                <h2 className="text-2xl font-bold text-slate-900 mb-4">إدارة الطلبات</h2>
                                <Card className="border-none shadow-md overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-right">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="px-6 py-4">رقم الطلب</th>
                                                        <th className="px-6 py-4">العميل</th>
                                                        <th className="px-6 py-4">الخدمة</th>
                                                        <th className="px-6 py-4">التفاصيل</th>
                                                        <th className="px-6 py-4">الحالة</th>
                                                        <th className="px-6 py-4 text-center">الإجراءات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {myBookings.map((booking: Booking) => (
                                                        <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-6 py-4 font-mono text-slate-400">#{booking.id}</td>
                                                            <td className="px-6 py-4 font-semibold">{booking.userName}</td>
                                                            <td className="px-6 py-4">{booking.serviceName}</td>
                                                            <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{booking.details}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold 
                                                                ${booking.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                                        booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                                                            booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                                    {booking.status === 'pending' ? 'جديد' :
                                                                        booking.status === 'confirmed' ? 'جاري التنفيذ' :
                                                                            booking.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex justify-center gap-2">
                                                                    {booking.status === 'pending' && (
                                                                        <>
                                                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => handleOrderStatus(booking.id, 'confirmed')}>
                                                                                قبول
                                                                            </Button>
                                                                            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => handleOrderStatus(booking.id, 'rejected')}>
                                                                                <X className="w-4 h-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    {booking.status === 'confirmed' && (
                                                                        <Button size="sm" className="bg-slate-800 hover:bg-slate-900 h-8 gap-2" onClick={() => handleOrderStatus(booking.id, 'completed')}>
                                                                            <Check className="w-4 h-4" /> إتمام الطلب
                                                                        </Button>
                                                                    )}
                                                                    {(booking.status === 'completed' || booking.status === 'rejected') && (
                                                                        <span className="text-slate-300 text-xs">-</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {myBookings.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-12 text-slate-400">
                                                                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                                                <p>لا توجد طلبات حتى الآن</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* 4. REVIEWS TAB */}
                        {activeTab === 'reviews' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                <h2 className="text-2xl font-bold text-slate-900 mb-4">آراء العملاء</h2>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {myReviews.map((review: Review) => (
                                        <Card key={review.id}>
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold">{review.userName}</h3>
                                                        <p className="text-xs text-slate-400">{review.date}</p>
                                                    </div>
                                                    <div className="flex text-yellow-500">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-slate-600 mt-2">"{review.comment}"</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {myReviews.length === 0 && (
                                        <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed text-slate-400">
                                            <p>لا توجد تقييمات بعد.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                    </div>
                </main>
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                >
                    <div
                        className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b flex items-center justify-between bg-orange-50">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                {capturedPreview ? '✅ معاينة الصورة' : '📷 التقاط صورة'}
                            </h3>
                            <button onClick={closeCamera} className="p-2 hover:bg-red-100 rounded-full text-red-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="relative bg-black aspect-video">
                            {/* Preview Mode - Show captured image */}
                            {capturedPreview ? (
                                <img
                                    src={capturedPreview}
                                    alt="معاينة الصورة"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    {/* Loading state */}
                                    {!isCameraReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white z-10">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-3"></div>
                                                <p>جاري تشغيل الكاميرا...</p>
                                            </div>
                                        </div>
                                    )}
                                    {/* Live video */}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                </>
                            )}
                        </div>

                        <div className="p-4 flex justify-center gap-4 bg-slate-50">
                            {capturedPreview ? (
                                <>
                                    {/* Preview mode buttons */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            console.log("استمر clicked");
                                            confirmPhoto();
                                        }}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-lg py-4 px-8 rounded-lg font-medium"
                                    >
                                        <Check className="w-6 h-6" />
                                        استمر
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            console.log("تعديل clicked");
                                            retakePhoto();
                                        }}
                                        className="flex items-center gap-2 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 text-lg py-4 px-6 rounded-lg font-medium"
                                    >
                                        <Camera className="w-5 h-5" />
                                        تعديل
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Camera mode buttons */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            console.log("التقاط clicked");
                                            capturePhoto();
                                        }}
                                        disabled={!isCameraReady}
                                        className={`flex items-center gap-2 text-white text-lg py-4 px-8 rounded-lg font-medium ${isCameraReady ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                    >
                                        <Camera className="w-6 h-6" />
                                        {isCameraReady ? 'التقاط الصورة' : 'انتظر...'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeCamera}
                                        className="flex items-center gap-2 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 text-lg py-4 px-6 rounded-lg font-medium"
                                    >
                                        إلغاء
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            )}
        </>
    );
}
