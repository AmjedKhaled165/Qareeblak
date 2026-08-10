"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Car, Package, MapPin, Phone, CheckCircle2, Loader2, DollarSign, FileText } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useAppStore } from "@/components/providers/AppProvider";
import { apiCall } from "@/lib/api";

interface ExtraServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: "utility" | "ride" | "parcel";
}

export function ExtraServiceModal({ isOpen, onClose, defaultCategory = "utility" }: ExtraServiceModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAppStore();

  const [serviceType, setServiceType] = useState<"utility" | "ride" | "parcel">(defaultCategory);
  const [utilityType, setUtilityType] = useState<"electricity" | "water" | "gas">("electricity");
  
  // User inputs
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  
  // Amount Handling for Utility
  const [amountMode, setAmountMode] = useState<"preset" | "none">("preset");
  const [selectedAmount, setSelectedAmount] = useState<number | "custom">(100);
  const [customAmount, setCustomAmount] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser?.phone) {
      setPhone(currentUser.phone);
    }
  }, [currentUser]);

  useEffect(() => {
    setServiceType(defaultCategory);
  }, [defaultCategory]);

  const handleSubmit = async () => {
    if (!address.trim()) {
      toast("يرجى إدخال عنوان الخدمة بالتفصيل", "error");
      return;
    }

    if (!phone.trim() || phone.length < 10) {
      toast("يرجى إدخال رقم تليفون صحيح للتواصل", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      let serviceTitle = "";
      let finalChargeAmount: number | null = null;

      if (serviceType === "utility") {
        const utilityNames = { electricity: "كهرباء", water: "مياه", gas: "غاز" };
        serviceTitle = `شحن كارت ${utilityNames[utilityType]}`;
        if (amountMode === "preset") {
          finalChargeAmount = selectedAmount === "custom" ? parseFloat(customAmount) || 0 : selectedAmount;
        }
      } else if (serviceType === "ride") {
        serviceTitle = "توصيلة مشوار (أفراد)";
      } else if (serviceType === "parcel") {
        serviceTitle = "توصيل طرد / غرض";
      }

      const orderPayload = {
        customer_name: currentUser?.name || "عميل قريبلك",
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        pickup_address: "موقع قريبلك - أسيوط الجديدة",
        order_type: "extra_service",
        source: "qareeblak_web",
        delivery_fee: 20, // Default estimated fee inside New Assiut
        items: [
          {
            name_ar: serviceTitle,
            quantity: 1,
            unit_price: finalChargeAmount || 0,
            total_price: finalChargeAmount || 0,
            notes: notes.trim() || undefined,
            extra_service_type: serviceType,
            utility_type: serviceType === "utility" ? utilityType : undefined,
            amount_specified: amountMode === "preset",
            charge_amount: finalChargeAmount,
          }
        ],
        notes: `[خدمات إضافية - ${serviceTitle}] ${notes.trim()}`
      };

      const result = await apiCall('/delivery/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload)
      });

      if (result && (result.id || result.success)) {
        toast(`تم إرسال طلب ${serviceTitle} بنجاح! سيتم التواصل معك قريباً 🚀`, "success");
        onClose();
        // Reset form
        setNotes("");
        if (!currentUser?.phone) setPhone("");
      } else {
        throw new Error(result?.error || "فشل إرسال الطلب");
      }
    } catch (err: any) {
      console.error("Failed to submit extra service order:", err);
      toast(err?.message || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md dir-rtl font-cairo bg-card rounded-3xl p-6 border-white/20 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader className="text-right space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-3 py-1 text-xs rounded-lg">
              خدمات إضافية
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-500">
            طلب مندوب خدمة
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            حدد نوع الخدمة والعنوان ليصلك مندوب قريبلك في أسرع وقت
          </DialogDescription>
        </DialogHeader>

        {/* Service Type Selector */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setServiceType("utility")}
            className={`p-3 rounded-2xl flex flex-col items-center gap-2 border transition-all text-xs font-bold ${
              serviceType === "utility"
                ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-md"
                : "border-border/60 hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Zap className="w-5 h-5 text-amber-500" />
            <span>شحن كروت</span>
          </button>

          <button
            type="button"
            onClick={() => setServiceType("ride")}
            className={`p-3 rounded-2xl flex flex-col items-center gap-2 border transition-all text-xs font-bold ${
              serviceType === "ride"
                ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-md"
                : "border-border/60 hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Car className="w-5 h-5 text-blue-500" />
            <span>توصيلة مشوار</span>
          </button>

          <button
            type="button"
            onClick={() => setServiceType("parcel")}
            className={`p-3 rounded-2xl flex flex-col items-center gap-2 border transition-all text-xs font-bold ${
              serviceType === "parcel"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-md"
                : "border-border/60 hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Package className="w-5 h-5 text-emerald-500" />
            <span>توصيل طرد</span>
          </button>
        </div>

        {/* Utility Sub-Options */}
        {serviceType === "utility" && (
          <div className="space-y-3 mt-4 p-4 rounded-2xl bg-muted/30 border border-border/40">
            <Label className="text-xs font-bold text-foreground/80">نوع الكارت المراد شحنه</Label>
            <div className="flex gap-2">
              {[
                { id: "electricity", label: "⚡ كهرباء" },
                { id: "water", label: "💧 مياه" },
                { id: "gas", label: "🔥 غاز" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setUtilityType(item.id as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    utilityType === item.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-background border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Amount Option */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-foreground/80 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  مبلغ الشحن
                </Label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAmountMode("preset")}
                    className={`px-2 py-1 rounded-lg font-bold ${amountMode === "preset" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                  >
                    تحديد مبلغ
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountMode("none")}
                    className={`px-2 py-1 rounded-lg font-bold ${amountMode === "none" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                  >
                    بدون تحديد
                  </button>
                </div>
              </div>

              {amountMode === "preset" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {[50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSelectedAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        selectedAmount === amt
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-background border-border/50 text-muted-foreground"
                      }`}
                    >
                      {amt} ج.م
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedAmount("custom")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedAmount === "custom"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-background border-border/50 text-muted-foreground"
                    }`}
                  >
                    مبلغ آخر
                  </button>

                  {selectedAmount === "custom" && (
                    <Input
                      type="number"
                      placeholder="أدخل المبلغ (ج.م)"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="h-9 text-xs mt-1 bg-background text-right"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inputs Form */}
        <div className="space-y-4 mt-4">
          <div className="space-y-2 text-right">
            <Label className="text-xs font-bold flex items-center gap-1.5 justify-end">
              <span>العنوان بالتفصيل</span>
              <MapPin className="w-3.5 h-3.5 text-primary" />
            </Label>
            <textarea
              rows={2}
              className="w-full p-3 rounded-xl border border-border/50 bg-background text-xs text-right focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
              placeholder="مثال: الحي الثاني - مجاورة 3 - عمارة 12 - شقة 4"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2 text-right">
            <Label className="text-xs font-bold flex items-center gap-1.5 justify-end">
              <span>رقم التليفون للتواصل</span>
              <Phone className="w-3.5 h-3.5 text-primary" />
            </Label>
            <Input
              type="tel"
              className="h-11 rounded-xl bg-background border-border/50 text-right text-xs"
              placeholder="01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2 text-right">
            <Label className="text-xs font-bold flex items-center gap-1.5 justify-end">
              <span>ملاحظات إضافية (اختياري)</span>
              <FileText className="w-3.5 h-3.5 text-primary" />
            </Label>
            <Input
              type="text"
              className="h-11 rounded-xl bg-background border-border/50 text-right text-xs"
              placeholder={
                serviceType === "utility"
                  ? "مثال: الكارت محتاج شحن سريع قبل الساعة 5"
                  : serviceType === "ride"
                  ? "مثال: عدد الأفراد 2 سكوتر أو سيارة"
                  : "مثال: الطرد عبارة عن شنطة ملابس"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/20 transition active:scale-95 text-sm mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                اطلب مندوب الآن
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
