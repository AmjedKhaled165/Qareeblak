# 📊 State Management & Data Flow

## Component State Variables

```tsx
// Order data
const [order, setOrder] = useState<Record<string, any> | null>(null);

// UI states
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Time tracking
const [timeLeft, setTimeLeft] = useState<number | null>(null);

// Edit modal
const [editingItem, setEditingItem] = useState<{
    id: string; 
    quantity: number
} | null>(null);
```

---

## Derived Values

```tsx
const isCancelled = 
    order.status === 'cancelled' || 
    order.status === 'rejected';

const modificationRules = canModifyOrder();

const canAddItems = modificationRules.allowed;
const canEditItem = modificationRules.allowed;
const canDeleteItem = modificationRules.allowed;
```

---

## Data Structure: Order Object

```tsx
interface Order {
    id: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
    halanStatus: 'pending' | 'assigned' | 'ready_for_pickup' | 'picked_up' | 'in_transit' | 'delivered';
    date: Date;  // ISO string
    providerId: string;
    providerName: string;
    serviceName: string;
    price: number;
    details: string;  // Contains address and notes
    items: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
    }>;
    courier?: {
        name: string;
        phone: string;
    };
    userId?: string;
    source?: 'qareeblak' | 'manual' | 'whatsapp';
    channel?: string;
    isQareeblak?: boolean;
}
```

---

## State Transitions

### Page Load:
```
Initial
  ↓
loading = true
  ↓
fetchOrderDetails()
  ↓
✅ Success → setOrder(data), loading = false
❌ Failure → setError(msg), loading = false
```

### Polling (Every 5 seconds):
```
fetchOrderDetails()
  ↓
Update: order, timeLeft
  ↓
Recalculate: canAddItems, canEditItem, canDeleteItem
  ↓
Re-render UI
```

### Edit Item Flow:
```
Click Edit (✏️)
  ↓
handleEditItem(item)
  ↓
setEditingItem({id, quantity})
  ↓
Modal appears
  ↓
User adjusts quantity
  ↓
Click "Save" or "Delete"
  ↓
handleSaveEditItem(newQty)
  ↓
API call: bookingsApi.update()
  ↓
✅ Success → fetchOrderDetails(), setEditingItem(null)
❌ Failure → toast(error), stay in modal
```

### Add Item Flow:
```
Click "Add Items"
  ↓
handleAddItems()
  ↓
router.push(`/explore?editOrder=${orderId}`)
  ↓
User on services page
  ↓
User selects items
  ↓
Services page: bookingsApi.update(orderId, {items})
  ↓
User routed back to /orders/[id]
  ↓
fetchOrderDetails() → shows updated items
```

---

## Validation Rules State

```tsx
// Input
order: Order | null
timeLeft: number | null

// Process
canModifyOrder(): {allowed: boolean; reason?: string}

// Output
modificationRules: {allowed: boolean; reason?: string}
canAddItems: boolean
canEditItem: boolean
canDeleteItem: boolean

// Used in
Conditional rendering of buttons
Modal visibility
Error message display
```

---

## API Calls

### GET /bookings/[id]
**Purpose**: Fetch order details
**Called**: On mount, every 5 seconds, after modifications
**Returns**: Order object
```tsx
const data = await bookingsApi.getById(orderId);
```

### PATCH /bookings/[id]
**Purpose**: Update order items
**Called**: When editing/deleting items
**Payload**: `{items: Array}`
```tsx
await bookingsApi.update(orderId, {items: updatedItems});
```

---

## Event Handlers

### handleAddItems()
```
Trigger: User clicks "Add Items" button
Condition: canAddItems === true
Action: Navigate to services page with editOrder param
Post: Services page handles item addition
```

### handleEditItem(item)
```
Trigger: User clicks ✏️ button next to item
Condition: canEditItem === true
Action: setEditingItem({id, quantity}), show modal
Post: User can modify and save
```

### handleSaveEditItem(newQuantity)
```
Trigger: User clicks Save or Delete in modal
Condition: editingItem exists
Action: 
  - If qty <= 0: Delete item
  - Else: Update quantity
  - Call API
  - Refresh order
Post: Modal closes, UI updates
```

### handleRemoveItem(itemId)
```
Trigger: User clicks 🗑️ button next to item
Condition: canDeleteItem === true
Action:
  - Filter out item
  - Call API
  - Refresh order
Post: Item removed from list
```

### handleCancel()
```
Trigger: User clicks "Cancel" during 5-min window
Condition: timeLeft > 0 AND status === 'pending'
Action:
  - Show confirmation dialog
  - If confirmed: Update status to 'cancelled'
  - Refresh order
Post: Order shows cancelled state
```

### fetchOrderDetails()
```
Trigger: Component mount, every 5 seconds, after modifications
Action:
  - Fetch order from API
  - Update order state
  - Recalculate timeLeft
  - Handle errors
Post: UI re-renders with latest data
```

---

## Time Calculation Logic

### Every Poll Cycle:
```
1. Get order.date (creation time)
2. Calculate diff = now - order.date
3. Calculate remaining = 300 - diff
4. If remaining > 0: setTimeLeft(remaining)
5. If remaining <= 0: setTimeLeft(0)
6. Re-evaluate: canModifyOrder()
7. Update UI
```

### Result:
```
0-1 min   → "4:00" remaining, buttons visible
1-2 min   → "3:00" remaining, buttons visible
3-4 min   → "1:00" remaining, buttons visible
4-5 min   → "0:00" remaining, buttons hide
5+ min    → "0:00" remaining, buttons stay hidden
```

---

## Conditional Rendering Map

```tsx
// Add Items Button
canAddItems 
  ✅ → Show button
  ❌ → Show message with reason

// Edit Button (per item)
canEditItem 
  ✅ → Show ✏️ button
  ❌ → Hidden

// Delete Button (per item)
canDeleteItem 
  ✅ → Show 🗑️ button
  ❌ → Hidden

// Edit Modal
editingItem !== null 
  ✅ → Show modal overlay + sheet
  ❌ → Hidden

// Loading State
loading === true
  ✅ → Show spinner
  ❌ → Show content

// Error State
error !== null
  ✅ → Show error screen
  ❌ → Show content

// Cancelled State
isCancelled === true
  ✅ → Show cancelled UI
  ❌ → Show normal UI
```

---

## Memory & Performance

### State Size:
- `order`: ~1-5 KB (typical order)
- `editingItem`: ~100 bytes
- `other states`: ~50 bytes
- **Total**: ~1-5 KB

### Polling Impact:
- Interval: 5 seconds
- API call size: ~1-5 KB response
- Network: Minimal
- CPU: Negligible

### Optimization Opportunities:
- Memoize `canModifyOrder()`
- Debounce quantity input
- Cache order if unchanged
- Virtual list for large item lists (unlikely needed)

---

## Error Scenarios

### Network Offline
```
fetchOrderDetails() fails
  → setError("Network error")
  → Show error screen
  → User can retry
```

### Order Not Found (404)
```
bookingsApi.getById() throws
  → Error caught
  → setError("Order not found")
  → Show "Order not found" screen
```

### Invalid Item ID
```
handleEditItem() called with invalid item
  → item not found in list
  → Modal shows but finds nothing
  → handleSaveEditItem() exits early
  → No-op
```

### Concurrent Updates
```
User A edits item on device A
User B edits same item on device B
  → Both send updates
  → Last write wins (depends on backend)
  → Next poll shows final state
```

---

## Testing Data

### Valid Order:
```json
{
    "id": "order-123",
    "status": "pending",
    "halanStatus": "assigned",
    "date": "2025-02-05T10:00:00Z",
    "providerId": "provider-1",
    "providerName": "Restaurant Name",
    "serviceName": "Pizza",
    "price": 150,
    "details": "العنوان: 123 Main St | ملاحظات: لا بصل",
    "items": [
        {"id": "item-1", "name": "Pizza", "price": 100, "quantity": 1},
        {"id": "item-2", "name": "Cola", "price": 50, "quantity": 1}
    ],
    "courier": {"name": "Ahmed", "phone": "201001234567"}
}
```

### Edge Cases:
```json
// No items
{"items": []}

// No courier (not picked up yet)
{"courier": null}

// Cancelled order
{"status": "cancelled", "halanStatus": "pending"}

// Already delivered
{"status": "completed", "halanStatus": "delivered"}

// In transit (can't modify)
{"halanStatus": "in_transit"}
```

---

## Debug Logging

```tsx
// Validation
console.log('canModifyOrder result:', modificationRules);
console.log('canAddItems:', canAddItems);
console.log('canEditItem:', canEditItem);
console.log('canDeleteItem:', canDeleteItem);

// Time
console.log('timeLeft:', timeLeft, 'seconds');
console.log('timeLeft display:', `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}`);

// Order
console.log('order.status:', order.status);
console.log('order.halanStatus:', order.halanStatus);
console.log('order.items:', order.items);

// Modal
console.log('editingItem:', editingItem);
```

---

## Summary

**Key Insight**: The refactor simplifies state management by:
1. Removing `isAddingItems` (modal logic)
2. Adding `editingItem` (editing logic)
3. Calculating permissions from validation function
4. Using conditional rendering instead of state-based toggles
5. Delegating "Add Item" to services page

**Result**: Cleaner, more maintainable, better UX.

