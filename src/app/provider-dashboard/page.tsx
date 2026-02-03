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

            // Check if mediaDevices is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast("عذراً، متصفحك لا يدعم الوصول للكاميرا", "error");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            }).catch(err => {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    throw new Error("يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح");
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    throw new Error("عذراً، لم يتم العثور على كاميرا متصلة بالجهاز");
                } else {
                    throw new Error("حدث خطأ أثناء محاولة تشغيل الكاميرا");
                }
            });

            setCameraStream(stream);
            setIsCameraOpen(true);

            // Wait for next render then attach stream
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (videoRef.current) {
                            videoRef.current.play().catch(e => console.error("Video play error:", e));
                            setIsCameraReady(true);
                        }
                    };
                }
            }, 300);
        } catch (err: any) {
            console.error("Camera error:", err);
            toast(err.message || "تعذر الوصول للكاميرا. تأكد من الأذونات.", "error");
        }
    };

    const capturePhoto = () => {
        try {
            if (!videoRef.current) {
                toast("خطأ: الكاميرا غير جاهزة", "error");
                return;
            }

            // Create temporary canvas if canvasRef is not ready
            const canvas = canvasRef.current || document.createElement('canvas');
            const video = videoRef.current;

            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = canvas.toDataURL('image/jpeg', 0.85);

                // Save to preview
                setCapturedPreview(imageData);

                // Stop camera stream while previewing
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }
            } else {
                toast("خطأ في معالجة الصورة", "error");
            }
        } catch (error) {
            console.error("Capture error:", error);
            toast("حدث خطأ أثناء التقاط الصورة", "error");
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
        setIsCameraReady(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setCameraStream(stream);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (videoRef.current) {
                            videoRef.current.play().catch(e => console.error("Video play error:", e));
                            setIsCameraReady(true);
                        }
                    };
                }
            }, 300);
        } catch (err) {
            console.error("Retake error:", err);
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
        return <div className="min-h-screen flex items-center justify-center bg-background text-primary animate-pulse">جاري التحميل...</div>;
    }

    if (!currentUser || currentUser.type !== 'provider') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full shadow-2xl text-center p-8 border-border/50 bg-card rounded-[2.5rem]">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LogOut className="w-10 h-10 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3 font-cairo">وصول غير مصرح به</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        عذراً، هذه الصفحة مخصصة لشركاء الخدمة فقط. يرجى تسجيل الدخول بحساب شريك معتمد.
                    </p>
                    <Button
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 text-lg font-bold"
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
        <div className="min-h-screen bg-background text-foreground dir-rtl flex transition-colors duration-500">

            {/* Sidebar (Desktop) */}
            <aside className="w-64 bg-card text-card-foreground border-l border-border/50 hidden md:flex flex-col fixed h-full right-0 z-10 transition-all">
                <div className="p-8 border-b border-border/50 bg-muted/20">
                    <h2 className="text-2xl font-black flex items-center gap-3 font-cairo">
                        <LayoutDashboard className="text-primary w-6 h-6" />
                        لوحة الشركاء
                    </h2>
                    <p className="text-xs text-muted-foreground mt-2 font-bold opacity-80">مرحباً، {currentUser.name}</p>
                </div>

                <nav className="flex-1 p-6 space-y-3">
                    <Button
                        variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        نظرة عامة
                    </Button>
                    <Button
                        variant={activeTab === 'orders' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'orders' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        <ShoppingBag className="w-5 h-5" />
                        الطلبات ({myBookings.filter((b: Booking) => b.status === 'pending').length})
                    </Button>
                    <Button
                        variant={activeTab === 'services' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'services' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('services')}
                    >
                        <Utensils className="w-5 h-5" />
                        المنيو / الخدمات
                    </Button>
                    <Button
                        variant={activeTab === 'reviews' ? 'secondary' : 'ghost'}
                        className={`w-full h-12 justify-start gap-4 rounded-xl font-bold font-cairo transition-all ${activeTab === 'reviews' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        onClick={() => setActiveTab('reviews')}
                    >
                        <Star className="w-5 h-5" />
                        التقييمات
                    </Button>
                </nav>

                <div className="p-6 border-t border-border/50">
                    <Button
                        variant="destructive"
                        className="w-full h-12 justify-start gap-4 rounded-xl font-bold"
                        onClick={() => { logout(); router.push('/login/provider'); }}
                    >
                        <LogOut className="w-5 h-5" />
                        تسجيل الخروج
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 md:mr-64 transition-all w-full min-h-screen">
                {/* Glowing background orbs */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
                <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] -z-10" />

                <div className="w-full space-y-10 relative z-10">

                    {/* Header Mobile */}
                    <div className="md:hidden flex items-center justify-between p-4 bg-card rounded-2xl border border-border/50 shadow-lg">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black text-foreground font-cairo">لوحة الشركاء</h1>
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive font-bold h-10 px-4 rounded-xl" onClick={() => logout()}>خروج</Button>
                    </div>

                    {/* 1. OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                            <div className="grid gap-6 md:grid-cols-3">
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-primary/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-primary/10 rounded-2xl text-primary transition-colors group-hover:bg-primary/20">
                                            <ShoppingBag className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">الطلبات الجديدة</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">{myBookings.filter((b: Booking) => b.status === 'pending').length}</h3>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-secondary/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-secondary/10 rounded-2xl text-secondary transition-colors group-hover:bg-secondary/20">
                                            <TrendingUp className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">إجمالي المبيعات</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">{myBookings.filter((b: Booking) => b.status === 'completed').length * 150} <span className="text-base font-bold text-muted-foreground">ج.م</span></h3>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/50 shadow-xl rounded-[2.5rem] overflow-hidden group hover:border-amber-500/50 transition-all">
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="p-5 bg-amber-500/10 rounded-2xl text-amber-500 transition-colors group-hover:bg-amber-500/20">
                                            <Star className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground font-bold font-cairo">التقييم العام</p>
                                            <h3 className="text-4xl font-black text-foreground mt-1">
                                                {myReviews.length > 0
                                                    ? (myReviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / myReviews.length).toFixed(1)
                                                    : '0'
                                                }
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b border-border/50 px-10 py-8">
                                    <CardTitle className="text-2xl font-black text-foreground font-cairo">آخر 5 طلبات</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-muted/50 text-muted-foreground font-black font-cairo border-b border-border/50">
                                                <tr>
                                                    <th className="px-10 py-6 text-foreground/80">العميل</th>
                                                    <th className="px-10 py-6 text-foreground/80">الخدمة</th>
                                                    <th className="px-10 py-6 text-foreground/80">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50 font-medium font-cairo">
                                                {myBookings.slice(0, 5).map((booking: Booking, i: number) => (
                                                    <tr key={i} className="hover:bg-muted/20 transition-all group">
                                                        <td className="px-10 py-6 font-black text-foreground text-lg">{booking.userName}</td>
                                                        <td className="px-10 py-6 text-muted-foreground">{booking.serviceName}</td>
                                                        <td className="px-10 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black
                                                                    ${booking.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                                                    booking.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                        'bg-muted/50 text-muted-foreground border border-border/50'}`}>
                                                                {booking.status === 'pending' ? 'جديد' : booking.status === 'completed' ? 'مكتمل' : booking.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {myBookings.length === 0 && (
                                                    <tr><td colSpan={3} className="text-center py-20 text-muted-foreground font-bold">لا توجد طلبات بعد</td></tr>
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
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-card/50 p-6 rounded-[2rem] border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h2 className="text-3xl font-black text-foreground font-cairo">الخدمات / المنيو</h2>
                                    <p className="text-muted-foreground font-medium mt-1 font-cairo">أضف عدل أو احذف خدماتك المعروضة للعملاء</p>
                                </div>
                                <Dialog open={isServiceModalOpen} onOpenChange={(open: boolean) => {
                                    if (open) setIsServiceModalOpen(true);
                                }}>
                                    <DialogTrigger asChild>
                                        <Button
                                            onClick={() => { resetServiceForm(); setEditingServiceId(null); }}
                                            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white gap-3 h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 text-lg font-black font-cairo"
                                        >
                                            <Plus className="w-6 h-6" /> إضافة خدمة جديدة
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent
                                        className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border rounded-[2.5rem] p-8 text-foreground"
                                        onInteractOutside={(e: Event) => e.preventDefault()}
                                        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
                                    >
                                        <DialogHeader className="flex flex-row items-center justify-between border-b border-border pb-6 mb-6">
                                            <DialogTitle className="text-2xl font-black font-cairo text-foreground">{editingServiceId ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
                                            <button
                                                type="button"
                                                onClick={() => setIsServiceModalOpen(false)}
                                                title="إغلاق"
                                                className="p-3 hover:bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-all"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </DialogHeader>
                                        <div className="space-y-6 py-2">
                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">اسم الخدمة / الأكلة <span className="text-destructive">*</span></Label>
                                                <Input className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 font-bold text-foreground transition-all" value={serviceForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="مثال: بيتزا مشكل جبن" />
                                            </div>

                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">الوصف <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                                                <Input className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 text-foreground transition-all" value={serviceForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="مكونات أو تفاصيل الخدمة" />
                                            </div>

                                            <div className="space-y-3 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">صورة الخدمة <span className="text-muted-foreground text-xs">(اختياري)</span></Label>

                                                {serviceForm.image && (
                                                    <div className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-border bg-background shadow-inner">
                                                        <img src={serviceForm.image} alt="معاينة" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setServiceForm({ ...serviceForm, image: "" })}
                                                            title="حذف الصورة"
                                                            className="absolute top-4 left-4 bg-destructive text-white p-2 rounded-xl hover:bg-destructive/90 transition-all shadow-lg"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {!serviceForm.image && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <label className="cursor-pointer group">
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setServiceForm({ ...serviceForm, image: reader.result as string });
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }} />
                                                            <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-2xl bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all">
                                                                <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <span className="text-sm font-bold font-cairo text-muted-foreground group-hover:text-foreground">رفع صورة</span>
                                                            </div>
                                                        </label>

                                                        <button
                                                            type="button"
                                                            onClick={openCamera}
                                                            title="التقاط صورة"
                                                            className="group"
                                                        >
                                                            <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-2xl bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all h-full w-full text-muted-foreground group-hover:text-foreground">
                                                                <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                <span className="text-sm font-bold font-cairo">الكاميرا</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2 text-right">
                                                <Label className="text-sm font-black text-muted-foreground mr-1 font-cairo">السعر (ج.م) <span className="text-destructive">*</span></Label>
                                                <Input type="number" className="h-12 rounded-xl bg-background border-border focus:border-primary px-4 font-black text-lg text-foreground" value={serviceForm.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, price: e.target.value })} placeholder="0" />
                                            </div>

                                            <div className="border-t border-border pt-6 mt-6">
                                                <div className="flex items-center gap-3 mb-5">
                                                    <input type="checkbox" id="hasOffer" title="إضافة عرض" checked={serviceForm.hasOffer} onChange={(e) => setServiceForm({ ...serviceForm, hasOffer: e.target.checked })} className="w-5 h-5 accent-primary rounded-lg" />
                                                    <Label htmlFor="hasOffer" className="cursor-pointer font-black font-cairo text-foreground">إضافة عرض ترويجي (خصم أو بونص)</Label>
                                                </div>

                                                {serviceForm.hasOffer && (
                                                    <div className="bg-background/50 p-6 rounded-2xl space-y-5 border border-border shadow-inner">
                                                        <div className="space-y-3">
                                                            <Label className="font-bold font-cairo block text-right text-muted-foreground">نوع العرض</Label>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <Button type="button" className={`h-11 rounded-xl font-bold font-cairo transition-all ${serviceForm.offerType === 'discount' ? 'bg-primary text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`} onClick={() => setServiceForm({ ...serviceForm, offerType: 'discount' })}>نسبة خصم %</Button>
                                                                <Button type="button" className={`h-11 rounded-xl font-bold font-cairo transition-all ${serviceForm.offerType === 'bundle' ? 'bg-primary text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`} onClick={() => setServiceForm({ ...serviceForm, offerType: 'bundle' })}>عرض بونص (X+Y)</Button>
                                                            </div>
                                                        </div>

                                                        {serviceForm.offerType === 'discount' && (
                                                            <div className="space-y-2 text-right">
                                                                <Label className="font-bold font-cairo text-muted-foreground">نسبة الخصم %</Label>
                                                                <div className="flex items-center gap-3">
                                                                    <Input type="number" className="h-12 w-24 rounded-xl bg-background border-border text-center font-black text-xl text-foreground" value={serviceForm.discountPercent} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, discountPercent: e.target.value })} placeholder="10" min="1" max="100" />
                                                                    <span className="text-foreground font-black text-xl">%</span>
                                                                    {serviceForm.discountPercent && serviceForm.price && (
                                                                        <span className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-sm font-black border border-emerald-500/20 mr-auto">
                                                                            سيصبح السعر: {Math.round(Number(serviceForm.price) * (1 - Number(serviceForm.discountPercent) / 100))} ج.م
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {serviceForm.offerType === 'bundle' && (
                                                            <div className="space-y-3 text-right">
                                                                <Label className="font-bold font-cairo text-muted-foreground">تفاصيل عرض البونص</Label>
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span className="font-bold font-cairo text-muted-foreground">اشتري</span>
                                                                    <Input type="number" className="h-12 w-20 rounded-xl bg-background border-border text-center font-black text-lg text-foreground" value={serviceForm.bundleCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleCount: e.target.value })} placeholder="3" />
                                                                    <span className="font-bold font-cairo text-muted-foreground">وخد</span>
                                                                    <Input type="number" className="h-12 w-20 rounded-xl bg-background border-border text-center font-black text-lg text-foreground" value={serviceForm.bundleFreeCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, bundleFreeCount: e.target.value })} placeholder="1" />
                                                                    <span className="font-bold font-cairo text-muted-foreground">هدية</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-2 text-right">
                                                            <Label className="font-bold font-cairo text-muted-foreground">تاريخ انتهاء العرض</Label>
                                                            <Input type="date" className="h-12 rounded-xl bg-background border-border text-right font-bold text-foreground" value={serviceForm.offerEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceForm({ ...serviceForm, offerEndDate: e.target.value })} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <DialogFooter className="border-t border-border pt-8 mt-6">
                                            <Button onClick={handleSaveService} className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/20 transition-all active:scale-95">حفظ التغييرات</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {myServices.map((service: any) => (
                                    <Card key={service.id} className="group hover:border-primary/50 transition-all overflow-hidden bg-card border-border/50 rounded-[2rem] shadow-xl flex flex-col">
                                        {service.image && (
                                            <div className="h-44 w-full overflow-hidden bg-muted relative">
                                                <img src={service.image} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        )}

                                        <CardHeader className="flex flex-row items-start justify-between pb-4 px-6 pt-6 gap-4">
                                            <div className="flex-1 text-right">
                                                <CardTitle className="text-xl font-black font-cairo text-foreground">{service.name}</CardTitle>
                                                <CardDescription className="line-clamp-2 mt-2 font-medium text-muted-foreground/80">{service.description}</CardDescription>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {service.offer ? (
                                                    <>
                                                        <span className="line-through text-muted-foreground/50 text-xs font-bold">{service.price} <small>ج.م</small></span>
                                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-lg font-black">
                                                            {service.offer.type === 'discount'
                                                                ? `${Math.round(service.price * (1 - (service.offer.discountPercent || 0) / 100))}`
                                                                : `${service.price}`
                                                            } <small className="text-[10px]">ج.م</small>
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="bg-muted px-4 py-2 rounded-xl text-lg font-black text-foreground border border-border/50">
                                                        {service.price} <small className="text-[10px]">ج.م</small>
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>

                                        {service.offer && (
                                            <div className="px-6 pb-2">
                                                <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-2xl text-xs font-black inline-flex items-center gap-2 font-cairo">
                                                    <span>🎁</span>
                                                    {service.offer.type === 'discount'
                                                        ? `خصم ${service.offer.discountPercent}% لفترة محدودة`
                                                        : `اشتري ${service.offer.bundleCount} وخد ${service.offer.bundleFreeCount} هدية!`
                                                    }
                                                </div>
                                            </div>
                                        )}

                                        <CardContent className="mt-auto px-6 pb-6 pt-4">
                                            <div className="flex gap-3 pt-6 border-t border-border/50">
                                                <Button size="sm" variant="outline" className="flex-1 h-12 gap-2 rounded-xl font-black font-cairo border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all" onClick={() => handleEditService(service)}>
                                                    <Edit className="w-5 h-5" /> تعديل
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    title="حذف الخدمة"
                                                    className="h-12 w-12 rounded-xl"
                                                    onClick={() => handleDeleteService(service.id)}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {myServices.length === 0 && (
                                    <div className="col-span-full text-center py-24 bg-card border-2 border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground space-y-4">
                                        <Utensils className="w-20 h-20 mx-auto opacity-10" />
                                        <p className="text-xl font-black font-cairo">لا توجد خدمات مضافة حالياً</p>
                                        <p className="font-medium max-w-xs mx-auto">ابدأ بزيادة مبيعاتك وأضف مأكولاتك أو خدماتك الآن!</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* 3. ORDERS TAB */}
                    {activeTab === 'orders' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-foreground font-cairo">إدارة الطلبات</h2>
                                <div className="text-sm font-bold bg-card border border-border/50 px-4 py-2 rounded-xl text-muted-foreground">{myBookings.length} طلب إجمالي</div>
                            </div>
                            <Card className="bg-card border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-muted/50 text-muted-foreground font-black font-cairo border-b border-border/50">
                                                <tr>
                                                    <th className="px-8 py-6">رقم الطلب</th>
                                                    <th className="px-8 py-6">العميل</th>
                                                    <th className="px-8 py-6">الخدمة</th>
                                                    <th className="px-8 py-6">التفاصيل</th>
                                                    <th className="px-8 py-6">الحالة</th>
                                                    <th className="px-8 py-6 text-center">الإجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50 font-medium font-cairo">
                                                {myBookings.map((booking: Booking) => (
                                                    <tr key={booking.id} className="hover:bg-muted/20 transition-all">
                                                        <td className="px-8 py-6 font-mono text-muted-foreground/60 text-xs">#{booking.id.substring(0, 8)}</td>
                                                        <td className="px-8 py-6 font-black text-foreground text-lg">{booking.userName}</td>
                                                        <td className="px-8 py-6 text-foreground/80 font-bold">{booking.serviceName}</td>
                                                        <td className="px-8 py-6 text-muted-foreground max-w-xs truncate">{booking.details || "لا يوجد ملاحظات"}</td>
                                                        <td className="px-8 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase
                                                                ${booking.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                                                    booking.status === 'confirmed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                                        booking.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                                                                {booking.status === 'pending' ? 'جديد' :
                                                                    booking.status === 'confirmed' ? 'جاري التنفيذ' :
                                                                        booking.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex justify-center gap-3">
                                                                {booking.status === 'pending' && (
                                                                    <>
                                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-10 px-5 rounded-xl text-white font-black" onClick={() => handleOrderStatus(booking.id, 'confirmed')}>
                                                                            قبول
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            title="رفض الطلب"
                                                                            className="h-10 w-10 p-0 border-destructive/50 text-destructive hover:bg-destructive/10 rounded-xl"
                                                                            onClick={() => handleOrderStatus(booking.id, 'rejected')}
                                                                        >
                                                                            <X className="w-5 h-5" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                {booking.status === 'confirmed' && (
                                                                    <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 h-11 px-6 rounded-xl gap-3 font-black" onClick={() => handleOrderStatus(booking.id, 'completed')}>
                                                                        <Check className="w-5 h-5" /> إتمام الطلب
                                                                    </Button>
                                                                )}
                                                                {(booking.status === 'completed' || booking.status === 'rejected') && (
                                                                    <span className="text-muted-foreground/30 font-black">ARKIVED</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {myBookings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-24 text-muted-foreground">
                                                            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                                            <p className="text-lg font-black font-cairo">لا توجد طلبات حتى الآن</p>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black text-foreground font-cairo">آراء العملاء</h2>
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl">
                                    <span className="text-amber-400 text-lg">⭐</span>
                                    <span className="font-black text-amber-500">{myReviews.length > 0 ? (myReviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / myReviews.length).toFixed(1) : "0.0"}</span>
                                </div>
                            </div>
                            <div className="grid gap-6 md:grid-cols-2">
                                {myReviews.map((review: Review) => (
                                    <Card key={review.id} className="bg-card border-border/50 rounded-[2rem] shadow-xl hover:border-primary/50 transition-all">
                                        <CardContent className="p-8">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4 text-right">
                                                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center font-black text-xl text-primary border border-border/50">
                                                        {review.userName[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-lg text-foreground font-cairo">{review.userName}</h3>
                                                        <p className="text-xs text-muted-foreground font-bold mt-1">{review.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'opacity-20'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute -top-4 -right-2 text-6xl text-primary/10 select-none">"</span>
                                                <p className="text-foreground/80 font-bold leading-relaxed pr-2 font-cairo">
                                                    {review.comment}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {myReviews.length === 0 && (
                                    <div className="col-span-full text-center py-24 bg-card border-2 border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground space-y-4">
                                        <Star className="w-20 h-20 mx-auto opacity-10" />
                                        <p className="text-xl font-black font-cairo">لا توجد تقييمات بعد</p>
                                        <p className="font-medium max-w-xs mx-auto">عندما يقوم العملاء بتقييم خدماتك، ستظهر آراؤهم هنا.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                </div>
            </main>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div
                    className="fixed inset-0 z-[10000] bg-background/90 backdrop-blur-xl flex items-center justify-center p-6 pointer-events-auto text-foreground"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-card rounded-[2.5rem] max-w-xl w-full overflow-hidden shadow-2xl border border-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-black text-xl flex items-center gap-3 font-cairo text-foreground">
                                {capturedPreview ? '✅ معاينة الصورة' : '📷 التقاط صورة للخدمة'}
                            </h3>
                            <button onClick={closeCamera} title="إغلاق" className="p-3 hover:bg-destructive/10 rounded-2xl text-muted-foreground hover:text-destructive transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="relative bg-black aspect-video shadow-inner">
                            {capturedPreview ? (
                                <img
                                    src={capturedPreview}
                                    alt="معاينة الصورة"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    {!isCameraReady && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/50 backdrop-blur-sm">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4 shadow-xl"></div>
                                                <p className="font-black font-cairo text-lg">جاري تجهيز الكاميرا...</p>
                                            </div>
                                        </div>
                                    )}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover grayscale-[0.2] contrast-[1.1]"
                                    />
                                    <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
                                </>
                            )}
                        </div>

                        <div className="p-8 flex justify-center gap-4 bg-muted/20">
                            {capturedPreview ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={confirmPhoto}
                                        className="flex-1 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xl py-5 rounded-2xl font-black font-cairo shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        <Check className="w-7 h-7" />
                                        استخدام الصورة
                                    </button>
                                    <button
                                        type="button"
                                        onClick={retakePhoto}
                                        className="flex-1 flex items-center justify-center gap-3 bg-muted border border-border hover:bg-accent text-foreground text-xl py-5 rounded-2xl font-black font-cairo transition-all"
                                    >
                                        <Camera className="w-6 h-6" />
                                        إعادة تصوير
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={capturePhoto}
                                        disabled={!isCameraReady}
                                        className={`flex-1 flex items-center justify-center gap-3 text-white text-xl py-5 rounded-2xl font-black font-cairo shadow-2xl transition-all active:scale-95 ${isCameraReady ? 'bg-primary hover:bg-primary/90 shadow-primary/20' : 'bg-muted cursor-not-allowed text-muted-foreground'}`}
                                    >
                                        <Camera className="w-7 h-7" />
                                        {isCameraReady ? 'التقاط الصورة' : 'برجاء الانتظار...'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeCamera}
                                        className="px-8 border border-border hover:bg-accent text-muted-foreground hover:text-foreground text-lg rounded-2xl font-bold font-cairo transition-all"
                                    >
                                        إلغاء
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
