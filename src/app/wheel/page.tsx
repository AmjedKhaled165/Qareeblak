"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { wheelApi } from "@/lib/api";
import { useToast } from "@/components/providers/ToastProvider";
import { Gift, Sparkles, AlertCircle, RefreshCw, CheckCircle, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import confetti from "canvas-confetti";

export default function WheelOfFortunePage() {
    const { currentUser } = useAppStore();
    const { toast } = useToast();

    const [prizes, setPrizes] = useState<any[]>([]);
    const [myPrizes, setMyPrizes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSpinning, setIsSpinning] = useState(false);
    const [wonPrize, setWonPrize] = useState<any>(null);

    // Animation state
    const wheelRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [availablePrizes, userPrizes] = await Promise.all([
                wheelApi.getPrizes(),
                currentUser ? wheelApi.getMyPrizes() : Promise.resolve([])
            ]);

            if (availablePrizes && availablePrizes.length > 0) {
                setPrizes(availablePrizes);
            } else {
                // Fallback for visual if no prizes
                setPrizes([
                    { name: 'حظ أوفر', color: '#ff4b4b' },
                    { name: 'خصم 10%', color: '#4CAF50' },
                    { name: 'توصيل مجاني', color: '#2196F3' },
                    { name: 'خصم 20%', color: '#FFC107' },
                ]);
            }
            if (userPrizes) setMyPrizes(userPrizes);
        } catch (error) {
            console.error(error);
            toast("تعذر تحميل بيانات العجلة", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSpin = async () => {
        if (!currentUser) {
            toast("يرجى تسجيل الدخول أولاً للمشاركة!", "error");
            return;
        }

        if (isSpinning) return;
        if (prizes.length === 0) return;

        setIsSpinning(true);
        setWonPrize(null);

        try {
            const result = await wheelApi.spin();

            if (result && result.success && result.prize) {
                const winIndex = prizes.findIndex(p => p.id === result.prize.id);
                // Calculate angle to land on the winning slice
                const sliceAngle = 360 / prizes.length;
                // Calculate exact rotation
                const absoluteTarget = 270 - (winIndex * sliceAngle + sliceAngle / 2);
                const currentMod = ((rotation % 360) + 360) % 360;
                const absoluteMod = ((absoluteTarget % 360) + 360) % 360;

                let angleDiff = absoluteMod - currentMod;
                if (angleDiff <= 0) angleDiff += 360;

                const targetRotation = rotation + angleDiff + (360 * 5);
                setRotation(targetRotation);

                // Wait for animation
                setTimeout(() => {
                    setWonPrize(result.prize);
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                    setIsSpinning(false);
                    // Refresh user prizes
                    loadData();
                }, 4000); // 4 seconds animation matches transition duration
            } else {
                throw new Error("Spin response invalid");
            }
        } catch (error: any) {
            console.error("Spin error:", error);
            setIsSpinning(false);
            if (error.response?.data?.error) {
                toast(error.response.data.error, "error");
            } else {
                toast("حدث خطأ أثناء المحاولة. يرجى إعادة المحاولة لاحقاً.", "error");
            }
        }
    };

    const getPrizeIcon = (type: string) => {
        switch (type) {
            case 'discount_percent': return <span className="font-bold text-lg">%</span>;
            case 'discount_flat': return <span className="font-bold text-sm">ج.م</span>;
            case 'free_delivery': return <RefreshCw className="w-5 h-5" />;
            default: return <Gift className="w-5 h-5" />;
        }
    };

    // Prepare SVG Wheel calculations
    const radius = 150;
    let currentAngle = 0;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">

            {/* Header */}
            <header className="bg-white px-6 py-4 sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <Link href="/explore">
                        <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 -mr-2 bg-slate-50">
                            <ChevronLeft className="w-5 h-5 text-slate-700" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h1 className="text-xl font-bold">عجلة الحظ</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto p-4 space-y-6">

                {/* Hero / Information Section */}
                <div className="bg-gradient-to-br from-primary to-orange-400 p-6 rounded-3xl shadow-xl shadow-primary/20 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-20">
                        <Gift className="w-24 h-24" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <h2 className="text-2xl font-black mb-2 flex items-center justify-center gap-2">
                            جرب حظك واربح! <Sparkles className="w-6 h-6 text-yellow-300" />
                        </h2>
                        <p className="text-white/80 text-sm leading-relaxed">
                            لف العجلة واكسب خصومات هائلة وجوائز توصيل مجاني على طلباتك القادمة.
                        </p>
                    </div>
                </div>

                {/* The Wheel */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center py-10">
                    <div className="relative w-[300px] h-[300px] flex justify-center items-center">
                        {/* Pointer Arrow */}
                        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 drop-shadow-lg">
                            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-slate-800"></div>
                        </div>

                        {/* SVG Wheel */}
                        <div
                            ref={wheelRef}
                            className="w-full h-full rounded-full overflow-hidden shadow-2xl relative"
                            style={{
                                transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0, 0.1, 1)' : 'transform 0.1s',
                                transform: `rotate(${rotation}deg)`
                            }}
                        >
                            <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-xl border-4 border-slate-800 rounded-full">
                                {prizes.length > 0 && prizes.map((prize, idx) => {
                                    const sliceAngle = 360 / prizes.length;
                                    const startAngle = idx * sliceAngle;
                                    const endAngle = startAngle + sliceAngle;

                                    const x1 = 150 + 150 * Math.cos(Math.PI * startAngle / 180);
                                    const y1 = 150 + 150 * Math.sin(Math.PI * startAngle / 180);
                                    const x2 = 150 + 150 * Math.cos(Math.PI * endAngle / 180);
                                    const y2 = 150 + 150 * Math.sin(Math.PI * endAngle / 180);

                                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                                    const d = [`M 150 150`, `L ${x1} ${y1}`, `A 150 150 0 ${largeArcFlag} 1 ${x2} ${y2}`, `Z`].join(' ');

                                    const textRotation = startAngle + sliceAngle / 2;

                                    return (
                                        <g key={idx}>
                                            <path d={d} fill={prize.color || '#fff'} stroke="#ffffff" strokeWidth="2" />
                                            <text
                                                x="150"
                                                y="150"
                                                fill="#ffffff"
                                                fontSize="12"
                                                fontWeight="bold"
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                transform={`rotate(${textRotation}, 150, 150) translate(80, 0)`}
                                            >
                                                {prize.name}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Center Dot */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-800 rounded-full border-4 border-white z-10 shadow-inner"></div>
                        </div>
                    </div>

                    <Button
                        onClick={handleSpin}
                        disabled={isSpinning || isLoading || !currentUser}
                        className="mt-8 rounded-full h-14 px-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 active:scale-95 transition-all w-full max-w-[200px]"
                    >
                        {isSpinning ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> جاري اللف...
                            </div>
                        ) : 'جرب حظك!'}
                    </Button>
                    {!currentUser && (
                        <p className="mt-4 text-sm text-red-500 font-medium">سجل دخولك أولاً لتتمكن من تجربة حظك</p>
                    )}
                </div>

                {/* My Prizes Section */}
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Gift className="w-6 h-6 text-primary" /> هداياك وجوائزك
                    </h3>

                    {myPrizes.length === 0 ? (
                        <div className="bg-white p-6 rounded-3xl text-center border border-slate-100 shadow-sm">
                            <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex justify-center items-center text-slate-300 mb-3">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <p className="text-slate-500 font-medium">لم تكسب أية جوائز بعد، اضغط على جرب حظك الان!</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {myPrizes.map((prize, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={idx}
                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group"
                                >
                                    <div
                                        className="w-12 h-12 rounded-xl flex justify-center items-center text-white shadow-inner flex-shrink-0"
                                        style={{ backgroundColor: prize.color || '#4caf50' }}
                                    >
                                        {getPrizeIcon(prize.prize_type)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900">{prize.name}</h4>
                                        <p className="text-sm text-slate-500">
                                            {prize.prize_type === 'free_delivery' ? 'استخدمه للحصول على توصيل مجاني' : `خصم ${prize.prize_value} ${prize.prize_type === 'discount_percent' ? '%' : 'ج.م'}`}
                                            {prize.provider_id ? ` (لمتجر معين)` : ' (لأي متجر)'}
                                        </p>
                                    </div>
                                    <div className="text-xs bg-slate-50 text-slate-500 px-3 py-1 rounded-full whitespace-nowrap">
                                        متاح للاستخدام
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Win Modal */}
            <AnimatePresence>
                {wonPrize && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setWonPrize(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.8, y: 50, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.8, y: 50, opacity: 0 }}
                            transition={{ type: "spring", damping: 20 }}
                            className="bg-white p-8 rounded-[2rem] w-full max-w-sm text-center relative z-10 shadow-2xl"
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full flex justify-center items-center border-[6px] border-slate-50 shadow-xl"
                                style={{ color: wonPrize.color || '#4caf50' }}
                            >
                                <CheckCircle className="w-12 h-12" />
                            </div>

                            <div className="mt-8 space-y-2">
                                <h3 className="text-sm font-bold text-slate-400">
                                    {wonPrize.type === 'none' ? 'حظاً أوفر المرة القادمة!' : 'مبرووووك لقد فزت بـ'}
                                </h3>
                                <h2 className="text-3xl font-black text-slate-900 pb-2" style={{ color: wonPrize.color || '#f44336' }}>
                                    {wonPrize.name}
                                </h2>
                                <p className="text-slate-500 text-sm">
                                    {wonPrize.type === 'none'
                                        ? 'لم يحالفك الحظ اليوم، جرب مرة أخرى غداً!'
                                        : 'سيتم حفظ هذه الجائزة في حسابك لتطبيقها على طلباتك القادمة. احتفل!'}
                                </p>
                            </div>

                            <Button
                                onClick={() => setWonPrize(null)}
                                className="w-full h-14 mt-8 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20"
                            >
                                رائع! إغلاق
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
