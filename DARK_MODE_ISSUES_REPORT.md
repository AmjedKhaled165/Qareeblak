# Dark Mode Issues Report - bg-white without dark variants

## Summary
Found **27 instances** of `bg-white` CSS classes that lack proper dark mode variants across the project. These components will show white backgrounds in dark mode, creating contrast and visibility issues.

---

## Critical Files (Top 11)

### 🔴 CRITICAL - 5+ Issues

#### 1. [src/app/track/[id]/page.tsx](src/app/track/[id]/page.tsx)
**Issues: 5 lines**
- Line 348: `className="p-2 hover:bg-white/10 rounded-full transition"`
- Line 355: `className="p-2 hover:bg-white/10 rounded-full transition"`
- Line 398: `className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6"`
- Line 513: `className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6"`
- Line 553: `className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 space-y-4"`

---

### 🟠 HIGH - 4 Issues

#### 2. [src/app/partner/manager/page.tsx](src/app/partner/manager/page.tsx)
**Issues: 4 lines**
- Line 220: `className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"`
- Line 227: `className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"`
- Line 343: `className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full..."` (weak dark variant)
- Line 347: `className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-violet-100..."` (weak dark variant)

#### 3. [src/app/orders/page.tsx](src/app/orders/page.tsx)
**Issues: 4 lines**
- Line 73: `className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100"`
- Line 94: `className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100"`
- Line 119: `className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden bg-white"`
- Line 152: `className="bg-white p-2 rounded-full border border-slate-100 group-hover:translate-x-[-4px] transition-transform"`

#### 4. [src/app/orders/[id]/page.tsx](src/app/orders/[id]/page.tsx)
**Issues: 4 lines**
- Line 302: `className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white"`
- Line 425: `className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden"`
- Line 516: `className="w-full bg-white rounded-t-[2rem] p-6"`
- Additional lines with `hover:bg-white` without dark variants

---

### 🟡 MEDIUM - 3 Issues

#### 5. [src/app/partner/owner/page.tsx](src/app/partner/owner/page.tsx)
**Issues: 3 lines**
- Line 287: `className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"`
- Line 294: `className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"`
- Line 447: `className="cursor-pointer hover:bg-white dark:hover:bg-white/5 p-3 rounded-xl transition-all text-center"` (inconsistent dark variant)

#### 6. [src/components/dashboards/OwnerDashboardLightMode.tsx](src/components/dashboards/OwnerDashboardLightMode.tsx)
**Issues: 3 lines**
- Line 30: `className="bg-white rounded-2xl p-6 border border-slate-100 transition-all"`
- Line 80: `className="bg-white border-b border-slate-100 px-6 py-4 shadow-sm"`
- Line 223: `className="bg-white rounded-2xl border border-slate-100 overflow-hidden"`
- Line 272: `className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center"`

#### 7. [src/app/partner/driver/page.tsx](src/app/partner/driver/page.tsx)
**Issues: 3 lines**
- Line 258: `className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"`
- Line 280: `className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-3xl p-5..."`
- Line 440: `className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-violet-500..."`

---

### 🟡 MEDIUM - 2 Issues

#### 8. [src/app/provider/[id]/page.tsx](src/app/provider/[id]/page.tsx)
**Issues: 2 lines**
- Line 120: `className="absolute -bottom-10 right-8 w-24 h-24 bg-white rounded-full p-1 shadow-md flex items-center justify-center"`
- Line 165: `className="text-slate-900 shadow-sm bg-white"`
- Line 183: `className="text-slate-900 shadow-sm bg-white"`
- Line 344: `className="text-center py-12 bg-white rounded-xl border border-dashed"`

#### 9. [src/app/partner/owner-orders/page.tsx](src/app/partner/owner-orders/page.tsx)
**Issues: 2 lines**
- Line 382: `className="p-2 bg-white/20 rounded-full"`
- Line 391: `className="mr-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"`

#### 10. [src/app/partner/all-drivers/page.tsx](src/app/partner/all-drivers/page.tsx)
**Issues: 2 lines**
- Line 306: `after:bg-white` (toggle switch knob - missing dark styling)
- Line 369: `className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full"` (weak dark variant)

#### 11. [src/app/page.tsx](src/app/page.tsx)
**Issues: 2 lines**
- Line 53: `className="absolute top-[20%] left-[10%] w-72 h-72 bg-white/10 dark:bg-white/5 rounded-full..."` (weak opacity variant)
- Line 134: `className="h-16 px-12 text-xl font-bold bg-white text-indigo-900 hover:bg-slate-100 rounded-2xl shadow-lg"` (CTA button - critical)

---

## Additional Files with Issues

#### [src/components/features/booking-modal.tsx](src/components/features/booking-modal.tsx)
- Line 136: `className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"`

#### [src/components/features/auth-guard-modal.tsx](src/components/features/auth-guard-modal.tsx)
- Line 33: `className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden text-center p-6"`

#### [src/app/partner/driver-details/[id]/page.tsx](src/app/partner/driver-details/[id]/page.tsx)
- Line 326: `className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"`

#### [src/app/partner/debug-assignments/page.tsx](src/app/partner/debug-assignments/page.tsx)
- Line 30: `className="p-10 bg-white min-h-screen text-black"` (entire page - critical)

#### [src/app/partner/managers/[id]/page.tsx](src/app/partner/managers/[id]/page.tsx)
- Line 214: `after:bg-white` (toggle switch knob)

---

## Recommended Fixes

### Pattern 1: Full bg-white (Priority: HIGH)
```tsx
// ❌ Before
className="bg-white rounded-2xl p-6"

// ✅ After
className="bg-white dark:bg-slate-900 rounded-2xl p-6"
```

### Pattern 2: Weak dark variants (Priority: MEDIUM)
```tsx
// ❌ Before
className="bg-slate-100 dark:bg-white/5"

// ✅ After
className="bg-slate-100 dark:bg-slate-800"
```

### Pattern 3: White opacity without dark (Priority: MEDIUM)
```tsx
// ❌ Before
className="bg-white/10 hover:bg-white/20"

// ✅ After
className="bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10"
```

### Pattern 4: Toggle switches (Priority: MEDIUM)
```tsx
// ❌ Before
after:bg-white after:border-gray-300

// ✅ After
after:bg-white dark:after:bg-slate-900 after:border-gray-300 dark:after:border-slate-700
```

---

## Summary by Pattern

| Pattern | Count | Priority | Example |
|---------|-------|----------|---------|
| Solid `bg-white` | 12 | HIGH | `bg-white` → `bg-white dark:bg-slate-900` |
| White opacity (`bg-white/X`) | 11 | MEDIUM | `bg-white/5` → `bg-white/5 dark:bg-slate-900/40` |
| Weak `dark:bg-white/*` | 4 | MEDIUM | `dark:bg-white/5` → `dark:bg-slate-800` |
| **Total** | **27** | - | - |

---

## Next Steps

1. Start with **HIGH priority** files (orders, track, dashboards)
2. Use consistent dark palette: `dark:bg-slate-800` or `dark:bg-slate-900`
3. For opacity variants, maintain proportional dark values
4. Test in dark mode using browser DevTools
5. Consider creating a reusable component pattern for cards/modals

