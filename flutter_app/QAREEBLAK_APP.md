# 📱 قريبلك - Qareeblak Mobile App

تطبيق Flutter احترافي لمنصة الخدمات المحلية قريبلك.

## ✨ المميزات

### 🎯 واجهة احترافية
- ✅ Material Design 3
- ✅ Dark/Light Mode
- ✅ Smooth Animations & Transitions
- ✅ Responsive Design (جميع أحجام الشاشات)

### 🔍 نظام البحث والفلترة
- ✅ Search bar متقدمة
- ✅ Category Filters
- ✅ Price Range Slider
- ✅ Multiple Sort Options (أحدث، تقييم، سعر)
- ✅ Real-time Filtering

### 🎨 تصميم موحد
- ✅ نفس Design من الويب
- ✅ Custom Theme System
- ✅ Consistent Color Palette
- ✅ Professional Typography

### ⚡ الأداء والتجربة
- ✅ Skeleton Loaders
- ✅ State Management (Riverpod)
- ✅ API Integration Ready
- ✅ Real-time Updates (Socket.io)

## 🚀 البدء السريع

### المتطلبات
- Flutter 3.0+
- Dart 3.0+
- Android SDK / Xcode (للـ iOS)

### التثبيت

```bash
# الدخول إلى مجلد المشروع
cd flutter_app

# تثبيت المكتبات
flutter pub get

# تشغيل التطبيق
flutter run
```

### تشغيل على جهاز محدد

```bash
# جميع الأجهزة المتاحة
flutter devices

# تشغيل على جهاز محدد
flutter run -d <device_id>
```

## 📱 Screens

### 🏠 Home Screen
- Welcome Banner
- Quick Search
- Categories Grid
- Trending Services
- Promotion Banner

### 🔍 Explore Screen
- **Advanced Filters:**
  - Category Selection
  - Price Range
  - Rating Filter
  - Sort Options
- **Services List:**
  - Professional Card Design
  - Ratings & Reviews
  - Pricing Info
  - Quick Access

### 💬 Chat Screen
- Real-time Messaging
- Service Provider Chat

### 👤 Profile Screen
- User Information
- Order History
- Saved Services
- Settings

## 🏗️ البنية المعمارية

```
lib/
├── config/
│   ├── api_config.dart      # API Configuration
│   └── app_theme.dart       # Theme System
├── models/
│   └── service_model.dart   # Data Models
├── providers/
│   ├── api_provider.dart    # API Provider
│   └── service_provider.dart # Service Provider
├── screens/
│   ├── home_screen.dart
│   ├── explore_screen.dart
│   ├── chat_screen.dart
│   └── profile_screen.dart
├── services/
│   └── api_service.dart     # API Service
├── utils/
│   └── service_sorter.dart  # Sorting & Filtering
└── widgets/
    ├── custom_app_bar.dart
    ├── skeleton_loader.dart
    ├── custom_bottom_nav.dart
    ├── service_card.dart
    ├── category_card.dart
    └── search_bar.dart
```

## 🔗 الربط مع الويب

التطبيق مرتبط بنفس Backend API للموقع الويب:

```
API Base URL: http://localhost:3000/api
```

### API Endpoints

```
GET    /api/services           # جميع الخدمات
GET    /api/services?category=X # خدمات بفئة محددة
POST   /api/search?q=X         # البحث
POST   /api/services/:id       # تفاصيل الخدمة
```

## 🎨 النظام اللوني

| الاسم | اللون | الاستخدام |
|------|-------|-----------|
| Primary | #4F46E5 | Primary Actions |
| Primary Light | #6366F1 | Secondary Actions |
| Secondary | #FED330 | Accents |
| Accent | #10B981 | Success |

## 📦 المكتبات الرئيسية

```yaml
# UI & Design
flutter_animate: ^4.2.0      # Animations
shimmer: ^3.0.0              # Shimmer Effect
google_fonts: ^6.1.0         # Google Fonts

# State Management
riverpod: ^2.4.0             # Provider Pattern
provider: ^6.1.0             # Context API

# HTTP & API
dio: ^5.3.1                  # HTTP Client
http: ^1.1.0                 # HTTP Library

# Firebase
firebase_core: ^2.24.0       # Firebase Core
firebase_auth: ^4.16.0       # Authentication
firebase_messaging: ^14.7.0  # Push Notifications

# Location & Maps
geolocator: ^9.0.2           # Location Services
google_maps_flutter: ^2.5.0  # Maps
```

## 🧪 الاختبار

```bash
# تشغيل Unit Tests
flutter test

# تشغيل Integration Tests
flutter test integration_test/
```

## 🔧 التطوير

### Hot Reload
```bash
flutter run
# اضغط 'r' للـ Hot Reload
# اضغط 'R' للـ Hot Restart
```

### Debug Mode
```bash
flutter run --debug
```

### Release Build
```bash
flutter build apk              # Android APK
flutter build ios              # iOS App
flutter build web              # Web Version
```

## 📋 قائمة المهام المتبقية

- [ ] ربط API بشكل كامل
- [ ] إضافة Firebase Authentication
- [ ] تحسين Search Performance
- [ ] إضافة Advanced Notifications
- [ ] Location-based Services
- [ ] Payment Integration
- [ ] Order Tracking
- [ ] Rating & Reviews System

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة
3. Commit التغييرات
4. Push إلى الفرع
5. فتح Pull Request

## 📞 الدعم

للمزيد من المعلومات والدعم:
- 📧 Email: support@qareeblak.com
- 🐛 Report Issues: GitHub Issues
- 💬 Chat: Discord

## 📄 الترخيص

MIT License - شاهد `LICENSE` للمزيد.

---

**تم التطوير بـ ❤️ من فريق قريبلك**
