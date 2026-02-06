# Qareeblak Order Management - Implementation Guide

## Overview
This document outlines the complete implementation for Qareeblak order handling, including special logic for orders from the Qareeblak source.

---

## Requirements Summary

### 1. Order Details Modal Logic
- **Current Behavior**: "Responsible" person (Admin/Manager) auto-assigned to every order
- **New Behavior for Qareeblak Orders**:
  - ✅ Hide the "Responsible" field completely from the UI
  - ✅ Do NOT assign a specific internal manager
  - ✅ Clearly show the order belongs to Qareeblak

### 2. Dashboard Metrics (Owner Dashboard)
- **New Metric**: "Qareeblak Delivery Revenue" card
  - Calculate: ONLY delivery fees (رسوم التوصيل) from Qareeblak orders
  - Exclude: Product prices
  - Label: "Qareeblak - رسوم التوصيل"
  - Click Action: Navigate to Orders List with automatic Qareeblak filter
  - Color: Purple (#8B5CF6) with Bike icon

### 3. Orders Filtering
- Enable filtering by order source: `qareeblak`, `manual`, `whatsapp`
- Query parameter: `?source=qareeblak`
- Pre-filtered view when clicking the Qareeblak card

---

## Frontend Implementation Status

### ✅ COMPLETED

#### 1. Owner Dashboard (`src/app/partner/owner/page.tsx`)
```typescript
// Calculate Qareeblak delivery revenue (only delivery fees)
const qareeblakOrders = deliveredOrders.filter((o: any) => o.source === 'qareeblak');
const qareeblakDeliveryRevenue = qareeblakOrders.reduce(
  (sum: number, o: any) => sum + parseFloat(o.delivery_fee || '0'), 0
);

// Stats card added to dashboard
<StatsCard
    title="Qareeblak - رسوم التوصيل"
    value={`${parseFloat(stats.summary.qareeblak_delivery_revenue || 0).toFixed(0)} ج.م`}
    icon={Bike}
    color="#8B5CF6"
    onClick={() => router.push('/partner/owner-orders?source=qareeblak')}
/>
```

**Changes Made:**
- Added `qareeblak_delivery_revenue` and `qareeblak_orders_count` to stats summary
- New card displays only delivery fees for Qareeblak orders
- Clicking navigates to `/partner/owner-orders?source=qareeblak`
- Card position: Between "Total Sales" and "Successful Orders"

#### 2. Order Details Modal (`src/app/partner/owner-orders/page.tsx`)
```typescript
// Driver & Manager Info - Conditionally hide Responsible field
<div className={`grid ${order.source === 'qareeblak' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
    <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
        {/* Courier section - always shown */}
    </div>
    {order.source !== 'qareeblak' && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
            {/* Manager/Responsible - hidden for Qareeblak */}
        </div>
    )}
</div>
```

**Changes Made:**
- Grid changes from 2 columns to 1 column for Qareeblak orders
- Responsible (المسؤول) field completely removed for Qareeblak
- Only courier information displayed for Qareeblak orders
- Conditional rendering: `{order.source !== 'qareeblak' && ...}`

#### 3. Orders Filter (`src/app/partner/owner-orders/page.tsx`)
```typescript
// Source filter added to URL parameters
const [sourceFilter, setSourceFilter] = useState<string>(
  searchParams.get('source') || 'all'
);

// Filter buttons UI with source options
<button onClick={() => setSourceFilter('qareeblak')}>
    🌐 قريبلك
</button>
<button onClick={() => setSourceFilter('manual')}>
    ✋ يدوي
</button>
<button onClick={() => setSourceFilter('whatsapp')}>
    📱 واتساب
</button>

// Include source filter in API request
if (sourceFilter !== 'all') params.append('source', sourceFilter);
```

**Changes Made:**
- Source filter added to `fetchOrders` function
- Filter buttons allow selection: All, Qareeblak, Manual, WhatsApp
- URL parameter automatically populated from `searchParams.get('source')`
- Source filter included in API request parameters

---

## Backend Implementation Required

### Database Schema
Ensure orders table has a `source` column:

```sql
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'manual';

-- Index for better query performance
CREATE INDEX idx_orders_source ON orders(source);
```

### Enum/Constants
```typescript
// Define order sources
enum OrderSource {
  QAREEBLAK = 'qareeblak',
  MANUAL = 'manual',
  WHATSAPP = 'whatsapp',
  API = 'api',
  IMPORT = 'import'
}
```

### API Endpoint: Get Orders with Filtering

**Endpoint**: `GET /halan/orders?source=qareeblak`

**Query Parameters**:
```
?source=qareeblak          // Filter by order source
?status=delivered          // Filter by status
?supervisorId=123          // Filter by manager
?courierId=456             // Filter by courier
?search=keyword            // Search in customer name/phone/address
```

**Required Backend Logic**:

```typescript
// Pseudo-code for backend filtering
async getOrders(query: {
  source?: string,
  status?: string,
  supervisorId?: number,
  courierId?: number,
  search?: string
}) {
  let query = db.orders.where({});
  
  // Apply filters
  if (source && source !== 'all') {
    query = query.where('source', '=', source);
  }
  
  if (status && status !== 'all') {
    query = query.where('status', '=', status);
  }
  
  if (supervisorId && supervisorId !== 'all') {
    query = query.where('supervisor_id', '=', supervisorId);
  }
  
  if (courierId && courierId !== 'all') {
    query = query.where('courier_id', '=', courierId);
  }
  
  if (search && search.trim()) {
    query = query.where(builder => {
      builder
        .where('customer_name', 'like', `%${search}%`)
        .orWhere('customer_phone', 'like', `%${search}%`)
        .orWhere('delivery_address', 'like', `%${search}%`)
    });
  }
  
  return await query.get();
}
```

### API Endpoint: Dashboard Stats

**Endpoint**: `GET /halan/dashboard/stats?period=today`

**Calculation Logic**:
```typescript
async getDashboardStats(period: 'today' | 'week' | 'month') {
  // Filter delivered orders by period
  const deliveredOrders = await db.orders
    .where('status', '=', 'delivered')
    .whereBetween('created_at', [periodStart, periodEnd])
    .get();

  // Qareeblak specific calculation
  const qareeblakOrders = deliveredOrders.filter(o => o.source === 'qareeblak');
  
  const qareeblakDeliveryRevenue = qareeblakOrders.reduce(
    (sum, order) => sum + parseFloat(order.delivery_fee || 0),
    0
  );

  const totalDeliveryFees = deliveredOrders.reduce(
    (sum, order) => sum + parseFloat(order.delivery_fee || 0),
    0
  );

  const totalSales = deliveredOrders.reduce((sum, order) => {
    const items = JSON.parse(order.items || '[]');
    const itemsTotal = items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );
    return sum + itemsTotal + parseFloat(order.delivery_fee || 0);
  }, 0);

  return {
    summary: {
      total_delivery_fees: totalDeliveryFees,
      total_sales: totalSales,
      delivered: deliveredOrders.length,
      total_orders: allOrders.length,
      qareeblak_delivery_revenue: qareeblakDeliveryRevenue,
      qareeblak_orders_count: qareeblakOrders.length
    }
  };
}
```

---

## Key Rules Implementation

### Rule 1: Qareeblak Orders - No Auto-Assignment

**When creating an order with source='qareeblak':**
```typescript
// Do NOT auto-assign a supervisor
const order = {
  customer_name: 'محمد أحمد',
  source: 'qareeblak',
  supervisor_id: null,  // ← IMPORTANT: Do NOT assign
  // ... other fields
};

// OR
const order = {
  customer_name: 'محمد أحمد',
  source: 'qareeblak',
  // supervisor_id field omitted entirely
  // ... other fields
};
```

### Rule 2: Delivery Revenue Calculation

**Only include delivery_fee, NOT product prices:**
```typescript
// CORRECT - Qareeblak revenue
const revenue = deliveredQareeblakOrders.reduce(
  (sum, order) => sum + order.delivery_fee,
  0
);

// WRONG - would include products
const revenue = deliveredQareeblakOrders.reduce(
  (sum, order) => sum + order.total_price,
  0
);
```

### Rule 3: UI Visibility

**Responsible field visibility:**
- **For qareeblak orders**: Hidden (not shown at all)
- **For manual/whatsapp/api orders**: Visible and shows assigned manager

---

## Testing Checklist

### Frontend Tests ✅
- [x] Dashboard shows Qareeblak card with correct calculation
- [x] Qareeblak card is clickable and navigates with filter
- [x] Order details modal hides Responsible field for Qareeblak
- [x] Filter buttons work and filter orders by source
- [x] URL parameters persist (e.g., ?source=qareeblak)

### Backend Tests (TO DO)
- [ ] `GET /halan/orders?source=qareeblak` returns only Qareeblak orders
- [ ] `GET /halan/dashboard/stats` calculates Qareeblak delivery revenue correctly
- [ ] Delivery revenue excludes product prices
- [ ] Filter combines properly with other filters (status, supervisorId, etc.)
- [ ] Search still works across all fields when source filter applied
- [ ] Orders created with source='qareeblak' have null supervisor_id

### UI/UX Tests
- [x] Qareeblak card displays in English: "Qareeblak - رسوم التوصيل"
- [x] Icon changes to Bike for Qareeblak card (Bike icon imported)
- [x] Color is purple (#8B5CF6)
- [x] Responsible section changes from 2 columns to 1 for Qareeblak
- [x] Filter buttons show emoji icons for visual distinction

---

## Code Snippets for Implementation

### Import Bike Icon (Already Done)
```typescript
import { ..., Bike, ... } from 'lucide-react';
```

### Store Configuration
If using state management, ensure order type includes source:
```typescript
interface Order {
  id: number;
  source?: 'qareeblak' | 'manual' | 'whatsapp' | 'api' | 'import';
  supervisor_id?: number;
  supervisor_name?: string;
  courier_id?: number;
  courier_name?: string;
  delivery_fee: number;
  total_price: number;
  // ... other fields
}
```

---

## Files Modified

1. **src/app/partner/owner/page.tsx** ✅
   - Added Qareeblak delivery revenue calculation
   - Added new stat card for Qareeblak orders
   - Updated stats state structure

2. **src/app/partner/owner-orders/page.tsx** ✅
   - Modified OrderDetailsModal to hide Responsible field
   - Added source filter to fetchOrders
   - Updated filter UI (already had buttons, now functional)

---

## Deployment Steps

1. **Database Migration**
   - Add `source` column to orders table
   - Set default value to 'manual' for existing orders
   - Create index on source column

2. **Backend Deployment**
   - Update order filtering logic to include source parameter
   - Update dashboard stats calculation
   - Test all new endpoints

3. **Frontend Deployment**
   - Deploy updated owner/page.tsx
   - Deploy updated owner-orders/page.tsx
   - Clear browser cache

4. **Verification**
   - Check dashboard displays Qareeblak card
   - Click Qareeblak card and verify filter
   - View Qareeblak order in modal and verify Responsible field hidden
   - Test combined filters (source + status + manager)

---

## Notes

- The **Bike icon** represents delivery/logistics, appropriate for delivery fee metrics
- **Purple color** (#8B5CF6) differentiates from other metrics (green for total fees, blue for sales)
- **Grid change** (2→1 columns) visually indicates Qareeblak orders have different structure
- **Filter buttons** use emojis (🌐📱✋) for quick visual identification
- **URL persistence** allows sharing filtered views: `/partner/owner-orders?source=qareeblak`

---

## Future Enhancements

1. Export Qareeblak orders as separate report
2. Batch operations for Qareeblak orders
3. Auto-billing integration for delivery fees
4. Analytics dashboard for Qareeblak performance
5. Qareeblak-specific notifications
