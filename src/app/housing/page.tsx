"use client";

import { useState } from "react";
import { Home, ShieldCheck, MessageSquare, Search, Star, MapPin, Bed, Wifi, PhoneOff, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/components/providers/AppProvider";
import { ConsultationChat } from "@/components/provider/ConsultationChat";

const HOUSING_CATEGORIES = [
  { id: "all", label: "كل السكن والعقارات 🏠" },
  { id: "طلاب", label: "سكن طلاب (بنين) 🎓" },
  { id: "طالبات", label: "سكن طالبات (بنات) 🌸" },
  { id: "مفروش", label: "شقق مفروشة 🛋️" },
  { id: "سمسار", label: "سماسرة ومكاتب عقار 🏢" },
];

export default function HousingPage() {
  const { providers } = useAppStore();
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChatBroker, setActiveChatBroker] = useState<any>(null);

  // Demo Student Housing Listings & Real Estate Brokers in New Assiut
  const defaultListings: any[] = [
    {
      id: "house-1",
      name: "سكن الفردوس للطلاب - الحي الثاني",
      category: "سكن طلاب - بنين",
      broker_name: "مكتب الإيمان العقاري",
      rating: 4.9,
      reviews_count: 24,
      location: "أسيوط الجديدة - الحي الثاني (خلف الجامعة)",
      price: "1,200 ج / شهرياً",
      beds: "سرير ثنائي في غرفة ثنائية",
      is_verified: true,
      has_wifi: true,
      image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=500&auto=format&fit=crop&q=80",
      description: "سكن طلاب مفروش بالكامل شامل المرافق والإنترنت السريع. قريب جداً من مجمع الكليات."
    },
    {
      id: "house-2",
      name: "سكن الياسمين الفاخر للطالبات",
      category: "سكن طالبات - بنات",
      broker_name: "المركز العربي للعقارات",
      rating: 5.0,
      reviews_count: 31,
      location: "أسيوط الجديدة - الحي الأول (منطقة الڤيلل)",
      price: "1,800 ج / شهرياً",
      beds: "غرفة خاصة سنجل",
      is_verified: true,
      has_wifi: true,
      image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500&auto=format&fit=crop&q=80",
      description: "سكن بناتي آمن ومكيف، كاميرات حراسة، مشرف مقيم، قريب من الباصات والمستشفى."
    },
    {
      id: "house-3",
      name: "شقة مفروشة VIP للطلاب والعائلات",
      category: "شقق مفروشة",
      broker_name: "سمسار أسيوط الجديدة - الحاج طارق",
      rating: 4.7,
      reviews_count: 19,
      location: "أسيوط الجديدة - ابني بيتك - المجاورة الرابعة",
      price: "4,500 ج / شهرياً",
      beds: "شقة 3 غرف ورسيبشن",
      is_verified: true,
      has_wifi: true,
      image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=500&auto=format&fit=crop&q=80",
      description: "شقة لوكس مفروشة جديدة بالكامل جاهزة للسكن الفوري، غاز طبيعي، مصعد وشاشة."
    },
    {
      id: "house-4",
      name: "مكتب المستقبل للتسويق العقاري وسكن الطلاب",
      category: "سماسرة ومكاتب عقار",
      broker_name: "م. كمال عبدالفتاح",
      rating: 4.8,
      reviews_count: 45,
      location: "أسيوط الجديدة - الميدان الرئيسي",
      price: "عمولة رمزية 5%",
      beds: "توفير كافة أنواع السكن والشقق",
      is_verified: true,
      has_wifi: false,
      image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&auto=format&fit=crop&q=80",
      description: "خبرة 8 سنوات في توفير أفضل سكن للطلاب والطالبات بأفضل الأسعار وبدون وسطاء غير مأمونين."
    }
  ];

  // Merge database housing/broker providers if present
  const dbHousing = providers.filter(p => {
    const cat = (p.category || "").toLowerCase();
    return cat.includes("سكن") || cat.includes("عقار") || cat.includes("سمسار") || cat.includes("شقق");
  });

  const allHousing: any[] = dbHousing.length > 0 ? dbHousing : defaultListings;

  const filteredHousing = allHousing.filter(item => {
    const matchesCategory = selectedType === "all" || (item.category || "").includes(selectedType) || (item.name || "").includes(selectedType);
    const matchesQuery = !searchQuery.trim() || item.name.includes(searchQuery) || item.location?.includes(searchQuery);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-cairo dir-rtl transition-colors duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-indigo-50 dark:from-emerald-950 dark:via-slate-900 dark:to-indigo-950 border-b border-emerald-100 dark:border-slate-800/80 py-8 px-4 relative overflow-hidden text-slate-900 dark:text-white">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="container max-w-6xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border border-emerald-300/60 dark:border-emerald-500/30 mb-3 shadow-sm">
            <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>دليل سكن الطلاب والسماسرة المعتمدين 🏠</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 tracking-tight text-slate-900 dark:text-white">
            ابحث عن <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">سكن الطلاب والشقق المفروشة</span> في أسيوط الجديدة
          </h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto text-sm md:text-base mb-6 leading-relaxed">
            تفاوض وتواصل آمن ومباشر مع السماسرة وأصحاب السكن بدون أرقام تليفونات لحماية الطالب ومنع الاحتيال.
          </p>

          {/* Security Alert Banner */}
          <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-900/90 border border-emerald-300/80 dark:border-emerald-500/40 rounded-2xl p-4 flex items-center gap-4 text-right shadow-sm dark:shadow-xl backdrop-blur-md">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30">
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm md:text-base">🛡️ محادثة آمنة ومعاينة موثوقة عبر منصة قريبلك</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                يتم حجب أرقام التليفونات في الشات تلقائياً لضمان تعامل آمن ومنع الاحتيال ولضمان مواصفات السكن المعلنة.
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
              placeholder="ابحث عن منطقة، سكن طلاب، أو مكتب سمسار..."
              className="pr-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:border-emerald-500 dark:focus:border-emerald-400 shadow-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto overflow-x-auto pb-2 scrollbar-none">
            {HOUSING_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedType(cat.id)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 border ${
                  selectedType === cat.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {filteredHousing.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-900">
              <Home className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">لم نجد سكن يطابق بحثك</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">جرب اختيار فئة أخرى أو تغيير عبارة البحث</p>
            <Button
              onClick={() => { setSelectedType("all"); setSearchQuery(""); }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs px-6 py-2.5"
            >
              عرض جميع خيارات السكن
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredHousing.map((item: any) => (
              <Card key={item.id} className="bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700/60 transition-all rounded-2xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-lg dark:hover:shadow-emerald-950/20 group">
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={item.image || item.avatar || "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=500&auto=format&fit=crop&q=80"}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>معتمد</span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-emerald-600 text-white font-bold text-xs sm:text-sm px-3.5 py-1 rounded-xl shadow-lg shadow-emerald-900/30">
                    {item.price || "حسب الطلب"}
                  </div>
                </div>

                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {item.name}
                    </h3>
                    <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {item.rating || 4.9} ({item.reviews_count || item.reviewsCount || 15})
                    </span>
                  </div>

                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-3">
                    {item.category} • {item.broker_name || "مكتب عقاري"}
                  </p>

                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-3">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{item.location || item.address || "أسيوط الجديدة"}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 mb-4 bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Bed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{item.beds || "غرف وأسرة متوفرة"}</span>
                    </div>
                    {item.has_wifi !== false && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold mr-auto bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/50">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>واي فاي مجاني</span>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 mb-4 leading-relaxed">
                    {item.description || "سكن وعقارات معتمدة في أسيوط الجديدة مع ضمان التعامل المباشر الآمن."}
                  </p>

                  <Button
                    onClick={() => setActiveChatBroker(item)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 py-3 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    شات وتفاوض آمن مع السمسار / صاحب السكن
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Secured Chat Modal */}
      {activeChatBroker && (
        <ConsultationChat
          isOpen={Boolean(activeChatBroker)}
          onClose={() => setActiveChatBroker(null)}
          consultation={{
            id: String(activeChatBroker.id),
            customer_id: 1,
            provider_id: Number(activeChatBroker.id) || 1,
            customer_name: activeChatBroker.name,
            status: 'active'
          }}
          providerId={String(activeChatBroker.id)}
          providerCategory={activeChatBroker.category}
        />
      )}
    </div>
  );
}

