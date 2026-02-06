# 🌐 Qareeblak Order Implementation Guide

## Overview

تطبيق نظام تصنيف الطلبيات حسب المصدر (قريبلك | يدوي | واتساب) مع عرض مرئي واضح ومنفصل لكل فئة.

---

## ✅ الخطوات المطبقة بالفعل (Frontend)

### 1. **تصنيف الطلبيات إلى 3 أقسام منفصلة**

**الملف**: `src/app/partner/owner-orders/page.tsx`

الصفحة الآن تعرض الطلبيات في 3 أقسام واضحة:

```
┌─────────────────────────────────────────┐
│ 🌐 طلبات قريبلك (عدد: 5)               │
│ ─────────────────────────────────────── │
│ • بطاقة خضراء بحد أيسر أخضر             │
│ • شريط أخضر في الأعلى: "🌐 قريبلك"    │
│ • بدون حقل "المسؤول"                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✋ طلبات يدوية (عدد: 12)                │
│ ─────────────────────────────────────── │
│ • بطاقة زرقاء بحد أيسر أزرق              │
│ • ظهور حقل "المسؤول"                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📱 طلبات واتساب (عدد: 8)               │
│ ─────────────────────────────────────── │
│ • بطاقة خضراء بحد أيسر أخضر              │
│ • ظهور حقل "المسؤول"                   │
└─────────────────────────────────────────┘
```

### 2. **فلاتر التصفية العلوية**

أزرار فلترة سريعة:

```tsx
🔘 الكل (يعرض كل الطلبيات)
🔘 🌐 قريبلك (يعرض قريبلك فقط)
🔘 ✋ يدوي (يعرض يدوي فقط)
🔘 📱 واتساب (يعرض واتساب فقط)
```

### 3. **ميزات العرض**

✅ **عداد لكل قسم**: يظهر عدد الطلبيات في كل فئة
✅ **ألوان مميزة**: لون مختلف لكل مصدر (أخضر = قريبلك، أزرق = يدوي، أخضر = واتساب)
✅ **شريط جانبي ملون**: حد أيسر ملون لتمييز بطاقات كل قسم
✅ **باج واضح**: "🌐 قريبلك" يظهر في الأعلى من كل بطاقة قريبلك
✅ **ترتيب تسلسلي**: القسم الأول يظهر أولاً (قريبلك)

---

## ⚠️ المتطلبات على Backend

### 1. **عمود `source` في قاعدة البيانات**

يجب أن تكون جميع الطلبيات لديها عمود `source` مع القيم التالية:

```sql
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'manual' NOT NULL;

-- الخيارات المدعومة:
-- 'qareeblak' - من موقع قريبلك
-- 'manual' - دخول يدوي
-- 'whatsapp' - من واتساب
-- 'api' - من API
-- 'import' - مستورد من نظام آخر
```

### 2. **API Endpoint: GET /halan/orders**

يجب أن يُرجع الـ endpoint الحقل `source` لكل طلب:

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "customer_name": "أحمد محمد",
      "customer_phone": "01001234567",
      "delivery_address": "شارع النيل، القاهرة",
      "source": "qareeblak",         // ← هذا الحقل مهم جداً!
      "status": "pending",
      "items": [...],
      "delivery_fee": 15,
      "total_price": 250,
      "created_at": "2025-02-05T10:30:00Z",
      "supervisor_id": null,          // ← يجب أن يكون null للطلبيات من قريبلك
      "supervisor_name": null
    },
    {
      "id": 102,
      "customer_name": "فاطمة علي",
      "customer_phone": "01101234567",
      "delivery_address": "مدينة الجيزة",
      "source": "manual",             // ← طلب يدوي
      "status": "assigned",
      "items": [...],
      "delivery_fee": 20,
      "total_price": 300,
      "created_at": "2025-02-05T11:00:00Z",
      "supervisor_id": 5,
      "supervisor_name": "محمود إبراهيم"
    }
  ],
  "count": 2
}
```

### 3. **API Endpoint: GET /halan/orders (مع Filter)**

يجب دعم تصفية حسب `source`:

```
GET /halan/orders?source=qareeblak
GET /halan/orders?source=manual
GET /halan/orders?source=whatsapp
GET /halan/orders?source=all  (أو بدون المعامل)
```

يمكن أيضاً الدمج مع فلاتر أخرى:

```
GET /halan/orders?source=qareeblak&status=pending
GET /halan/orders?source=manual&supervisorId=5&status=delivered
GET /halan/orders?search=أحمد&source=qareeblak
```

### 4. **API Endpoint: POST /halan/orders (إنشاء طلب)**

عند إنشاء طلب جديد، يجب تضمين الحقل `source`:

```json
{
  "customer_name": "أحمد محمد",
  "customer_phone": "01001234567",
  "delivery_address": "شارع النيل، القاهرة",
  "source": "qareeblak",           // ← تحديد المصدر
  "delivery_fee": 15,
  "items": [
    {
      "name": "كنتاكي",
      "price": 45,
      "quantity": 1
    }
  ],
  "supervisor_id": null            // ← يجب أن يكون null للـ qareeblak
}
```

**ردّ API**:

```json
{
  "success": true,
  "id": 105,
  "message": "تم إنشاء الطلب بنجاح"
}
```

### 5. **API Endpoint: GET /halan/orders/:id**

يجب أن يُرجع الحقل `source` أيضاً:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "customer_name": "أحمد محمد",
    "source": "qareeblak",        // ← يجب أن يكون موجود
    "status": "pending",
    ...
  }
}
```

### 6. **API Endpoint: PUT /halan/orders/:id (تحديث)**

عند تحديث طلب، يجب الحفاظ على قيمة `source` الأصلية:

```json
{
  "customer_name": "أحمد محمد علي",
  "delivery_address": "شارع النيل الجديد، القاهرة",
  "source": "qareeblak",    // ← الحفاظ على القيمة الأصلية
  ...
}
```

---

## 🔍 التحقق من التطبيق

### 1. **تحقق من console logs**

عند فتح صفحة الطلبيات (`/partner/owner-orders`)، يجب أن ترى logs مشابهة:

```javascript
📋 Orders fetched - Source field check: {
  count: 3,
  sources: [
    { id: 101, source: 'qareeblak', customer: 'أحمد محمد' },
    { id: 102, source: 'manual', customer: 'فاطمة علي' },
    { id: 103, source: 'whatsapp', customer: 'محمود حسن' }
  ]
}
```

**إذا رأيت `source: undefined`**: المشكلة في الـ backend (لم يُرسل الحقل).

### 2. **تحقق من الصفحة مباشرة**

- ✅ يجب أن ترى 3 أقسام منفصلة مع رؤوس ملونة
- ✅ يجب أن يكون هناك عداد أعلى كل قسم
- ✅ البطاقات في قسم قريبلك يجب أن تكون خضراء مع حد أيسر أخضر
- ✅ البطاقات في قسم يدوي يجب أن تكون زرقاء مع حد أيسر أزرق
- ✅ باج "🌐 قريبلك" يجب أن يظهر أعلى كل بطاقة قريبلك

### 3. **تحقق من الفلاتر**

- ✅ اضغط على "🌐 قريبلك": يجب أن ترى قريبلك فقط
- ✅ اضغط على "✋ يدوي": يجب أن ترى يدوي فقط
- ✅ اضغط على "📱 واتساب": يجب أن ترى واتساب فقط
- ✅ اضغط على "الكل": يجب أن ترى الجميع

---

## 🛠️ Backend Implementation Example (Node.js + Knex.js)

### الخطوة 1: Migration

```typescript
exports.up = async (knex) => {
  // إضافة عمود source للجداول الموجودة
  await knex.schema.table('orders', (table) => {
    table.enum('source', ['qareeblak', 'manual', 'whatsapp', 'api', 'import'])
      .notNullable()
      .defaultTo('manual')
      .comment('مصدر الطلب - قريبلك أو يدوي أو واتساب');
  });

  // إضافة indices لتحسين الأداء
  await knex.schema.table('orders', (table) => {
    table.index('source');
    table.index(['source', 'status']);
    table.index(['source', 'created_at']);
  });
};

exports.down = async (knex) => {
  await knex.schema.table('orders', (table) => {
    table.dropIndex('source');
    table.dropIndex(['source', 'status']);
    table.dropIndex(['source', 'created_at']);
    table.dropColumn('source');
  });
};
```

### الخطوة 2: Order Repository

```typescript
class OrderRepository {
  async getOrders(filters: {
    source?: string;
    status?: string;
    supervisorId?: number;
    courierId?: number;
    search?: string;
  } = {}) {
    let query = this.db('orders');

    // تصفية حسب المصدر
    if (filters.source && filters.source !== 'all') {
      query = query.where('source', filters.source);
    }

    // تصفية حسب الحالة
    if (filters.status && filters.status !== 'all') {
      query = query.where('status', filters.status);
    }

    // تصفية حسب المسؤول
    if (filters.supervisorId && filters.supervisorId !== 'all') {
      query = query.where('supervisor_id', filters.supervisorId);
    }

    // تصفية حسب المندوب
    if (filters.courierId && filters.courierId !== 'all') {
      query = query.where('courier_id', filters.courierId);
    }

    // بحث نصي
    if (filters.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.where((builder) => {
        builder
          .where('customer_name', 'like', searchTerm)
          .orWhere('customer_phone', 'like', searchTerm)
          .orWhere('delivery_address', 'like', searchTerm)
          .orWhere('notes', 'like', searchTerm);
      });
    }

    // الترتيب: الأحدث أولاً
    query = query.orderBy('created_at', 'desc');

    return await query.select('*');
  }

  async createOrder(data: {
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    source: 'qareeblak' | 'manual' | 'whatsapp' | 'api' | 'import';
    delivery_fee: number;
    items: any[];
    supervisor_id?: number | null;
  }) {
    // طلبيات قريبلك: لا تحتاج مسؤول
    let supervisorId = data.supervisor_id;
    if (data.source === 'qareeblak') {
      supervisorId = null;
    }

    const [id] = await this.db('orders').insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      delivery_address: data.delivery_address,
      source: data.source,             // ← تخزين المصدر
      delivery_fee: data.delivery_fee,
      items: JSON.stringify(data.items),
      supervisor_id: supervisorId,
      status: 'pending',
      created_at: new Date()
    });

    return id;
  }
}
```

### الخطوة 3: Express Router

```typescript
router.get('/orders', async (req, res) => {
  try {
    const filters = {
      source: req.query.source as string,
      status: req.query.status as string,
      supervisorId: req.query.supervisorId 
        ? parseInt(req.query.supervisorId as string)
        : undefined,
      courierId: req.query.courierId 
        ? parseInt(req.query.courierId as string)
        : undefined,
      search: req.query.search as string
    };

    const orders = await orderRepository.getOrders(filters);

    console.log(`📋 Fetched ${orders.length} orders with filters:`, filters);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      filters: {
        active: Object.entries(filters)
          .filter(([_, v]) => v && v !== 'all')
          .map(([k]) => k)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'فشل في جلب الطلبيات'
    });
  }
});
```

---

## 📊 Statistics Integration

للحصول على إحصائيات منفصلة حسب المصدر:

```typescript
async getDashboardStats() {
  const deliveredOrders = await this.db('orders')
    .where('status', 'delivered')
    .where('created_at', '>=', this.getPeriodStart());

  const bySource = {
    qareeblak: deliveredOrders.filter(o => o.source === 'qareeblak'),
    manual: deliveredOrders.filter(o => o.source === 'manual'),
    whatsapp: deliveredOrders.filter(o => o.source === 'whatsapp')
  };

  return {
    total: deliveredOrders.length,
    qareeblak: {
      count: bySource.qareeblak.length,
      revenue: this.sumDeliveryFees(bySource.qareeblak)
    },
    manual: {
      count: bySource.manual.length,
      revenue: this.sumDeliveryFees(bySource.manual)
    },
    whatsapp: {
      count: bySource.whatsapp.length,
      revenue: this.sumDeliveryFees(bySource.whatsapp)
    }
  };
}
```

---

## 🧪 Testing Checklist

- [ ] تم إضافة عمود `source` في قاعدة البيانات
- [ ] جميع الطلبيات الموجودة لها قيمة `source` (افتراضي: 'manual')
- [ ] API endpoint يُرجع الحقل `source` بشكل صحيح
- [ ] فلاتر البحث تعمل بناءً على `source`
- [ ] عند إنشاء طلب من قريبلك، يتم تعيين `source = 'qareeblak'`
- [ ] طلبيات قريبلك لا تملك `supervisor_id`
- [ ] الأقسام الثلاثة تظهر بشكل منفصل في الـ frontend
- [ ] الألوان والشارات صحيحة
- [ ] الفلاتر تعمل بشكل صحيح
- [ ] console logs تظهر `source` field بشكل صحيح

---

## 📝 ملاحظات مهمة

1. **عدم التأخير**: تطبيق `source` field يجب أن يكون أولوية عالية
2. **البيانات القديمة**: جميع الطلبيات الموجودة يجب أن تحصل على `source = 'manual'` افتراضياً
3. **الأداء**: أضف indices على عمود `source` لتحسين سرعة الاستعلامات
4. **التناسق**: جميع endpoints يجب أن ترجع الحقل `source`
5. **التوثيق**: وثّق قيم `source` المدعومة في API documentation

---

## 🚀 Next Steps

1. ✅ تطبيق Backend: إضافة عمود `source` ومعالجة الفلاتر
2. ✅ اختبار API: التأكد من ارجاع الحقل `source`
3. ✅ اختبار Frontend: التحقق من عرض الأقسام بشكل صحيح
4. التطبيق على صفحات أخرى: Order tracking, Dashboard, etc.
5. إضافة إحصائيات منفصلة حسب المصدر

---

**آخر تحديث**: 2025-02-05
**الحالة**: ✅ Frontend مكتمل | ⏳ Backend انتظار التطبيق
