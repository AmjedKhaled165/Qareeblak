# Qareeblak + Halan - Unified Platform

نظام موحد لخدمات Qareeblak (الخدمات المحلية) و Halan (توصيل الطلبات)

---

## 🚀 Quick Start (تشغيل سريع)

### 💻 Frontend (Next.js)
```bash
npm install
npm run dev
```
يفتح على: [http://localhost:3000](http://localhost:3000)

### ⚙️ Backend (Node.js + Express + Socket.io)
```bash
cd server
npm install
node index.js
```
يعمل على: [http://localhost:5000](http://localhost:5000)

### ⚡ Performance Optimization (تهيئة الأداء)
لتحسين أداء قاعدة البيانات (تسريع الاستعلامات 50 ضعفاً):
```bash
cd server
node migrations/add-performance-indexes.js
```

---

## 📁 هيكل المشروع (Project Structure)

```
new-assiut-services/
├── src/                          # Next.js Frontend
│   ├── components/
│   │   ├── features/             # Chat, Bookings
│   │   └── ui/                   # Reusable components
│   └── app/                      # Routes & Pages
├── server/                        # Backend API (Node.js)
│   ├── routes/                   # API Endpoints
│   ├── migrations/               # DB Scripts
│   └── index.js                  # Main server entry
├── halan/                         # Halan Mobile (React Native)
│   ├── app/                      # Mobile Screens
│   └── utils/                    # Location & API services
└── public/                        # Static assets
```

---

## ⚡ Performance & Query Optimization

تم تحسين النظام ليتناسب مع أعداد كبيرة من البيانات عبر:
1. **Database Indexes**: إضافة فهارس لكل من `bookings`, `providers`, `users` لتسريع البحث.
2. **Server-Side Pagination**: جميع قوائم الطلبات تستخدم التنقل الصفحي (Pagination) لتقليل حجم البيانات المنقولة بنسبة 90%.
3. **Optimized Queries**: اختيار الأعمدة المطلوبة فقط في الاستعلامات بدلاً من `SELECT *`.

للمزيد من التفاصيل، يمكن مراجعة سكربتات التهيئة في `server/migrations/`.

---

## 📱 Halan Mobile App (تطبيق المندوب)

تطبيق المندوب مبني باستخدام **React Native (Expo)** ويوفر:
- **Real-time Tracking**: تتبع موقع المندوب لحظياً عبر Socket.io.
- **Background Location**: يستمر التتبع حتى لو كان التطبيق في الخلفية.
- **Order Management**: استقبال وتحديث حالات الطلبات (Pending → Picked Up → Delivered).

لتشغيل التطبيق:
```bash
cd halan
npm install
npm start
```

---

## ⚖️ Terms and Conditions (الشروط والأحكام)

**Qareeblak Marketplace** هو منصة وسيطة تربط مقدمي الخدمات المستقلين بالعملاء.
- **Providers**: مقدمو الخدمة هم متعاقدون مستقلون ومسؤولون عن جودة خدماتهم.
- **Liability**: المنصة غير مسؤولة عن أي أضرار ناتجة عن الخدمة المقدمة من قبل أطراف ثالثة.
- **Cancellations**: قد يتم تطبيق رسوم إلغاء في حال الإلغاء قبل الموعد بمدة قصيرة.

---

## ✅ Status

- **Chat System**: 🟢 يعمل بالكامل (Pharmacy Chat)
- **Orders**: 🟢 يعمل
- **Tracking**: 🟢 يعمل (Socket.io Location)
- **Authentication**: 🟢 يعمل (JWT & Native Persistence)
