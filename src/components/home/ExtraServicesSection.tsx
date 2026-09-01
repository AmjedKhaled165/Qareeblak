"use client";

import { useState } from "react";
import { Zap, Car, Package, ChevronLeft, ShieldCheck, Sparkles } from "lucide-react";
import { ExtraServiceModal } from "@/components/services/ExtraServiceModal";

export function ExtraServicesSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"utility" | "ride" | "parcel">("utility");

  const openServiceModal = (category: "utility" | "ride" | "parcel") => {
    setSelectedCategory(category);
    setModalOpen(true);
  };

  return (
    <section className="py-8 font-cairo">
      <div className="container px-4 mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-amber-500">
                خدمات إضافية وسريعة
              </h2>
              <p className="text-xs text-muted-foreground">شحن كروت، توصيلات أفراد، وتوصيل طرود بكبسة زر</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Utility Charging */}
          <div
            onClick={() => openServiceModal("utility")}
            className="group relative p-5 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-amber-500/10 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                خدمة سريعة ⚡
              </span>
            </div>

            <div className="mt-4 space-y-1 text-right">
              <h3 className="font-extrabold text-base text-foreground group-hover:text-amber-500 transition-colors">
                شحن كروت (كهرباء / مياه / غاز)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                اطلب مندوب يتولى استلام وشحن الكارت أو تعبئته في أسرع وقت.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40 text-xs font-bold text-amber-500">
              <span className="flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                <span>اطلب مندوب الآن</span>
                <ChevronLeft className="w-4 h-4" />
              </span>
              <span className="text-muted-foreground font-normal text-[11px]">بدون انتظار</span>
            </div>
          </div>

          {/* Card 2: Passenger Ride */}
          <div
            onClick={() => openServiceModal("ride")}
            className="group relative p-5 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-blue-500/10 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                توصيلة 🚗
              </span>
            </div>

            <div className="mt-4 space-y-1 text-right">
              <h3 className="font-extrabold text-base text-foreground group-hover:text-blue-500 transition-colors">
                توصيلة مشوار (أفراد)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                توصيل داخل وخارج أسيوط الجديدة مع أفضل الكباتن والمناديب.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40 text-xs font-bold text-blue-500">
              <span className="flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                <span>اطلب مشوار الآن</span>
                <ChevronLeft className="w-4 h-4" />
              </span>
              <span className="text-muted-foreground font-normal text-[11px]">أمان وراحة</span>
            </div>
          </div>

          {/* Card 3: Parcel Delivery */}
          <div
            onClick={() => openServiceModal("parcel")}
            className="group relative p-5 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-emerald-500/10 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="p-3.5 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                نقل طرود 📦
              </span>
            </div>

            <div className="mt-4 space-y-1 text-right">
              <h3 className="font-extrabold text-base text-foreground group-hover:text-emerald-500 transition-colors">
                توصيل طرد من مكان لمكان
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                انقل أوراق، هدايا، أو أي غرض من مكانك لأي مكان آخر فوراً.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40 text-xs font-bold text-emerald-500">
              <span className="flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                <span>إرسال طرد الآن</span>
                <ChevronLeft className="w-4 h-4" />
              </span>
              <span className="text-muted-foreground font-normal text-[11px]">تسليم مباشر</span>
            </div>
          </div>
        </div>

        {/* Modal */}
        <ExtraServiceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultCategory={selectedCategory}
        />
      </div>
    </section>
  );
}
