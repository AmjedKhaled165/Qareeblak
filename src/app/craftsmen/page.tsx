"use client";

import { useState } from "react";
import { Wrench, Search, Star, MapPin, PhoneOff, MessageSquare, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/components/providers/AppProvider";
import { ConsultationChat } from "@/components/provider/ConsultationChat";
import { MaintenanceBookingModal } from "@/components/features/maintenance-booking-modal";

const CRAFT_TYPES = [
  { id: "all", label: "الجميع 🛠️" },
  { id: "سباك", label: "سباكة 🚰" },
  { id: "كهربائي", label: "كهرباء ⚡" },
  { id: "نجار", label: "نجارة 🪵" },
  { id: "نقاش", label: "نقاشة ودهانات 🎨" },
  { id: "تكييف", label: "تكييف وتبريد ❄️" },
  { id: "تصليح", label: "أجهزة منزلية 🔌" },
  { id: "ميكانيكي", label: "ميكانيكا وسيارات 🚗" },
];

export default function CraftsmenPage() {
  const { providers } = useAppStore();
  const [selectedCraft, setSelectedCraft] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChatProvider, setActiveChatProvider] = useState<any>(null);
  const [activeBookingProvider, setActiveBookingProvider] = useState<any>(null);

  // Default mock craftsmen for demo if DB has few
  const defaultCraftsmen: any[] = [
    {
      id: "craft-1",
      name: "الأسطى مصطفى كمال - سباكة وصيانة",
      category: "صنايعي - سباك",
      rating: 4.9,
      reviews_count: 38,
      location: "أسيوط الجديدة - الحي الثاني",
      is_online: true,
      price_range: "زيارة فحص: 100 ج",
      avatar: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150&auto=format&fit=crop&q=80",
      description: "خبرة 12 سنة في تركيب وتسليك وحل أعطال السباكة بالكامل. ضمان على الأعمال."
    },
    {
      id: "craft-2",
      name: "الأسطى أحمد الكهربائي",
      category: "صنايعي - كهربائي",
      rating: 4.8,
      reviews_count: 52,
      location: "أسيوط الجديدة - الحي الأول",
      is_online: true,
      price_range: "زيارة فحص: 120 ج",
      avatar: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=150&auto=format&fit=crop&q=80",
      description: "تأسيس وصيانة شبكات الكهرباء، تركيب لوحات، حل شورت الكهرباء فوراً."
    },
    {
      id: "craft-3",
      name: "المركز الفني للتكييف والتبريد",
      category: "صنايعي - تكييف",
      rating: 5.0,
      reviews_count: 29,
      location: "أسيوط الجديدة - ابني بيتك",
      is_online: false,
      price_range: "زيارة وشحن: 250 ج",
      avatar: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=150&auto=format&fit=crop&q=80",
      description: "صيانة وتنظيف وتأسيس جميع أنواع التكييفات (اسبليت وشباك) وقطع غيار أصلية."
    },
    {
      id: "craft-4",
      name: "الأسطى محمود النجار",
      category: "صنايعي - نجار",
      rating: 4.7,
      reviews_count: 41,
      location: "أسيوط الجديدة - المجاورة الثالثة",
      is_online: true,
      price_range: "معاينة: 90 ج",
      avatar: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=150&auto=format&fit=crop&q=80",
      description: "تصليح الأبواب والشبابيك، تجميع وتفكيك أثاث إيكيا، وغرف النوم."
    }
  ];

  // Merge real database craftsmen with defaults
  const realCraftsmen = providers.filter(p => {
    const cat = (p.category || "").toLowerCase();
    return cat.includes("صنايعي") || cat.includes("صيانة") || cat.includes("سباك") || cat.includes("كهربائي") || cat.includes("نجار") || cat.includes("تكييف") || cat.includes("نقاش");
  });

  const allList: any[] = realCraftsmen.length > 0 ? realCraftsmen : defaultCraftsmen;

  const filteredCraftsmen = allList.filter(item => {
    const matchesCraft = selectedCraft === "all" || (item.category || "").includes(selectedCraft) || (item.name || "").includes(selectedCraft);
    const matchesQuery = !searchQuery.trim() || item.name.includes(searchQuery) || item.location?.includes(searchQuery);
    return matchesCraft && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-cairo dir-rtl transition-colors duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50/60 to-cyan-50 dark:from-blue-950 dark:via-slate-900 dark:to-indigo-950 border-b border-blue-100 dark:border-slate-800/80 py-8 px-4 relative overflow-hidden text-slate-900 dark:text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="container max-w-6xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border border-blue-300/60 dark:border-blue-500/30 mb-3 shadow-sm">
            <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>خدمة صنايعية أسيوط الجديدة 🛠️</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 tracking-tight text-slate-900 dark:text-white">
            أفضل <span className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">الصنايعية والمهنيين</span> في مدينتك
          </h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base mb-6 leading-relaxed">
            تواصل مباشر وحجز معاينات مع أفضل السباكين والكهربائية والنجارين بالتواصل الآمن وضمان منصة قريبلك.
          </p>

          {/* Security Alert Banner */}
          <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-900/90 border border-amber-300/80 dark:border-amber-500/40 rounded-2xl p-4 flex items-center gap-4 text-right shadow-sm dark:shadow-xl backdrop-blur-md">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/30">
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-300 text-xs sm:text-sm md:text-base">🛡️ محادثة وتفاوض آمن تماماً بدون أرقام هواتف</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                يتم حجب أرقام التليفونات في الشات تلقائياً لضمان حقوقك وحصولك على ضمان المنصة في المعاينة والأعمال.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3.5 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بتخصص، اسم الصنايعي، أو الحي..."
              className="pr-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 shadow-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto overflow-x-auto pb-2 scrollbar-none">
            {CRAFT_TYPES.map(craft => (
              <button
                key={craft.id}
                onClick={() => setSelectedCraft(craft.id)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 border ${
                  selectedCraft === craft.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm"
                }`}
              >
                {craft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Craftsmen Grid */}
        {filteredCraftsmen.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-900">
              <Wrench className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">لم نجد صنايعية يطابقون بحثك</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">جرب تغيير التخصص أو كلمة البحث للوصول لأفضل المتاحين</p>
            <Button
              onClick={() => { setSelectedCraft("all"); setSearchQuery(""); }}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs px-6 py-2.5"
            >
              عرض جميع الصنايعية
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCraftsmen.map((craft: any) => (
              <Card key={craft.id} className="bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700/60 transition-all rounded-2xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-lg dark:hover:shadow-blue-950/20 group">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex gap-4 items-start">
                    <div className="relative shrink-0">
                      <img
                        src={craft.avatar || craft.image || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150&auto=format&fit=crop&q=80"}
                        alt={craft.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700/80 shadow-inner"
                      />
                      {craft.is_online && (
                        <span className="absolute -bottom-1 -left-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white dark:border-slate-900" title="متصل الآن">
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {craft.name}
                        </h3>
                        <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {craft.rating || 4.8} ({craft.reviews_count || craft.reviewsCount || 12})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/50">
                          {craft.category}
                        </span>
                        {craft.price_range && (
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            💰 {craft.price_range}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-3">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                        <span className="truncate">{craft.location || craft.address || "أسيوط الجديدة"}</span>
                      </div>

                      <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 mb-4 leading-relaxed bg-slate-50/80 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        {craft.description || "صنايعي معتمد ومجرب في أسيوط الجديدة مع ضمان المنصة."}
                      </p>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          onClick={() => setActiveChatProvider(craft)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 py-2.5 shadow-md shadow-blue-600/20 transition-all"
                        >
                          <MessageSquare className="w-4 h-4" />
                          محادثة آمنة
                        </Button>
                        <Button
                          onClick={() => setActiveBookingProvider(craft)}
                          variant="outline"
                          className="flex-1 border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 py-2.5 transition-all"
                        >
                          <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          طلب معاينة
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Secured Consultation Chat Modal */}
      {activeChatProvider && (
        <ConsultationChat
          isOpen={Boolean(activeChatProvider)}
          onClose={() => setActiveChatProvider(null)}
          consultation={{
            id: String(activeChatProvider.id),
            customer_id: 1,
            provider_id: Number(activeChatProvider.id) || 1,
            customer_name: activeChatProvider.name,
            status: 'active'
          }}
          providerId={String(activeChatProvider.id)}
          providerCategory={activeChatProvider.category}
        />
      )}

      {/* Maintenance Booking Modal */}
      {activeBookingProvider && (
        <MaintenanceBookingModal
          open={Boolean(activeBookingProvider)}
          onOpenChange={(open) => {
            if (!open) setActiveBookingProvider(null);
          }}
          provider={{
            id: String(activeBookingProvider.id),
            name: activeBookingProvider.name,
            category: activeBookingProvider.category || 'صيانة',
            services: activeBookingProvider.services || []
          }}
        />
      )}
    </div>
  );
}

