# 🔄 Before & After Comparison

## Component Structure

### BEFORE:
```tsx
export default function OrderTrackingPage() {
    const [order, setOrder] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isAddingItems, setIsAddingItems] = useState(false);
    const [providerMenu, setProviderMenu] = useState<Array<Record<string, any>>>([]);
    
    // 1 modal state
    // 1 menu loading
    // Complex toggle logic
}
```

### AFTER:
```tsx
export default function OrderTrackingPage() {
    const [order, setOrder] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [editingItem, setEditingItem] = useState<{id: string; quantity: number} | null>(null);
    
    // Added error state
    // Replaced isAddingItems with editingItem
    // Removed providerMenu
    // Cleaner state management
    
    const canModifyOrder = (): {allowed: boolean; reason?: string} => {
        // Centralized validation logic
    };
}
```

---

## Add Items Workflow

### BEFORE:

#### Button:
```tsx
{canAddItems && (
    <Button 
        onClick={() => setIsAddingItems(!isAddingItems)}
        className="..."
    >
        <Plus /> إضافة أصناف
    </Button>
)}
```

#### Modal UI:
```tsx
<AnimatePresence>
    {isAddingItems && (
        <motion.div>
            <div className="border-b border-indigo-100 bg-indigo-50/30">
                <div className="p-6 space-y-4">
                    <p className="text-xs font-black text-indigo-600 uppercase">
                        أضف المزيد من القائمة
                    </p>
                    <div className="space-y-3">
                        {providerMenu.map((item) => (
                            <div key={item.id} className="bg-white p-3 rounded-xl">
                                <div>
                                    <p className="font-bold text-sm">{item.name}</p>
                                    <p className="text-xs text-indigo-600 font-bold">
                                        {item.price} ج.م
                                    </p>
                                </div>
                                <Button 
                                    onClick={() => handleAddItem(item)}
                                    className="bg-indigo-600"
                                >
                                    <Plus />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )}
</AnimatePresence>
```

#### Handler:
```tsx
const handleAddItem = async (item: Record<string, any>) => {
    try {
        const currentItems = [...(order?.items || [])];
        const existing = currentItems.find(i => i.id === item.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            currentItems.push({...item, quantity: 1});
        }
        await bookingsApi.update(orderId, {items: currentItems});
        toast(`تمت إضافة ${item.name} للطلب`, "success");
    } catch (error) {
        toast(error.message, "error");
    }
};
```

#### Load Provider Menu:
```tsx
useEffect(() => {
    if (isAddingItems && order && providerMenu.length === 0) {
        providersApi.getById(order.providerId).then(p => {
            setProviderMenu(p.services || []);
        });
    }
}, [isAddingItems, order, providerMenu.length]);
```

---

### AFTER:

#### Button:
```tsx
{canAddItems ? (
    <Button 
        onClick={handleAddItems}
        className="..."
    >
        <Plus /> إضافة أصناف
    </Button>
) : (
    <div className="text-xs text-slate-400 font-bold">
        {modificationRules.reason}
    </div>
)}
```

#### Handler:
```tsx
const handleAddItems = () => {
    router.push(`/explore?editOrder={orderId}`);
};
```

#### Load Provider Menu:
```tsx
// REMOVED - services page handles this
```

#### Benefits:
- ✅ No modal UI code in order page
- ✅ Cleaner separation of concerns
- ✅ Better UX (full services page)
- ✅ Simpler state management

---

## Edit Item Feature

### BEFORE:
```tsx
// This feature didn't exist
// Users couldn't edit items
// Had to delete and re-add
```

### AFTER:

#### State:
```tsx
const [editingItem, setEditingItem] = useState<{
    id: string; 
    quantity: number
} | null>(null);
```

#### Button:
```tsx
{canEditItem && (
    <button 
        onClick={() => handleEditItem(item)}
        title="تعديل المنتج"
        className="p-2 text-slate-300 hover:text-indigo-600"
    >
        ✏️
    </button>
)}
```

#### Handlers:
```tsx
const handleEditItem = (item: Record<string, any>) => {
    setEditingItem({id: item.id, quantity: item.quantity});
};

const handleSaveEditItem = async (newQuantity: number) => {
    try {
        const currentItems = [...(order?.items || [])];
        const idx = currentItems.findIndex(i => i.id === editingItem.id);
        
        if (idx >= 0) {
            if (newQuantity <= 0) {
                currentItems.splice(idx, 1);
                toast("تم حذف المنتج", "success");
            } else {
                currentItems[idx].quantity = newQuantity;
                toast("تم تحديث المنتج", "success");
            }
            
            await bookingsApi.update(orderId, {items: currentItems});
            setEditingItem(null);
            fetchOrderDetails();
        }
    } catch (error) {
        toast(error.message, "error");
    }
};
```

#### Modal:
```tsx
<AnimatePresence>
    {editingItem && order?.items && (
        <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <motion.div className="w-full bg-white rounded-t-[2rem] p-6">
                {/* Header */}
                <h2 className="text-2xl font-black">{item.name}</h2>
                
                {/* Quantity Control */}
                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => handleSaveEditItem(qty - 1)}>−</button>
                    <input value={editingItem.quantity} />
                    <button onClick={() => handleSaveEditItem(qty + 1)}>+</button>
                </div>
                
                {/* Total */}
                <div>{item.price * editingItem.quantity} ج.م</div>
                
                {/* Actions */}
                <Button onClick={() => setEditingItem(null)}>إلغاء</Button>
                <Button onClick={() => handleSaveEditItem(qty)}>حفظ</Button>
                <Button onClick={() => handleSaveEditItem(0)}>حذف</Button>
            </motion.div>
        </motion.div>
    )}
</AnimatePresence>
```

#### Benefits:
- ✅ Users can modify quantities directly
- ✅ No need to delete and re-add
- ✅ Smooth modal experience
- ✅ Delete from edit modal

---

## Validation Logic

### BEFORE:
```tsx
const isCancelled = order.status === 'cancelled' || order.status === 'rejected';
const canModify = (timeLeft !== null && timeLeft > 0) && order.status === 'pending';
const canAddItems = order.halanStatus !== 'delivered' && 
                   order.status !== 'delivered' && 
                   !isCancelled;

// Issues:
// - Time check buried in canAddItems
// - "Out for Delivery" status not explicitly checked
// - Different conditions for different actions
```

### AFTER:
```tsx
const canModifyOrder = (): {allowed: boolean; reason?: string} => {
    if (!order) return {allowed: false, reason: "جاري تحميل البيانات..."};
    
    // Rule B: Check delivery status first (highest priority)
    const outForDeliveryStatuses = ['in_transit', 'picked_up'];
    if (outForDeliveryStatuses.includes(order.halanStatus)) {
        return {
            allowed: false,
            reason: "لا يمكن تعديل الطلب أثناء توصيله"
        };
    }

    // Rule A: Check time window
    if (timeLeft === null || timeLeft <= 0) {
        return {
            allowed: false,
            reason: "انتهت فترة التعديل (5 دقائق)"
        };
    }

    return {allowed: true};
};

const modificationRules = canModifyOrder();
const canAddItems = modificationRules.allowed;
const canEditItem = modificationRules.allowed;
const canDeleteItem = modificationRules.allowed;

// Benefits:
// ✅ Clear priority order
// ✅ Explicit "Out for Delivery" check
// ✅ Consistent permissions
// ✅ User-friendly reason messages
```

---

## Button Visibility

### BEFORE:
```tsx
// Add Items Button
{canAddItems && (
    <Button onClick={() => setIsAddingItems(!isAddingItems)}>
        <Plus /> إضافة أصناف
    </Button>
)}

// Edit Button
{canModify && (
    <button onClick={() => handleRemoveItem(item.id)}>
        <Trash2 />
    </button>
)}

// Delete Button
{canModify && (
    <button onClick={() => handleRemoveItem(item.id)}>
        <Trash2 />
    </button>
)}

// Issues:
// - No feedback when disabled
// - Same permission for Edit/Delete (both used canModify)
// - No edit feature
```

### AFTER:
```tsx
// Add Items Button
{canAddItems ? (
    <Button onClick={handleAddItems}>
        <Plus /> إضافة أصناف
    </Button>
) : (
    <div className="text-xs text-slate-400">
        {modificationRules.reason}
    </div>
)}

// Edit Button
{canEditItem && (
    <button onClick={() => handleEditItem(item)}>✏️</button>
)}

// Delete Button
{canDeleteItem && (
    <button onClick={() => handleRemoveItem(item.id)}>
        <Trash2 />
    </button>
)}

// Benefits:
// ✅ User sees why button is disabled
// ✅ Clear individual permissions
// ✅ Edit feature available
// ✅ Better UX explanation
```

---

## Error Handling

### BEFORE:
```tsx
const fetchOrderDetails = async () => {
    try {
        const data = await bookingsApi.getById(orderId);
        setOrder(data);
        // ...
    } catch (error) {
        console.error("Failed to fetch order:", error);
        // No error state, no UI feedback
    }
};
```

### AFTER:
```tsx
const [error, setError] = useState<string | null>(null);

const fetchOrderDetails = async () => {
    try {
        const data = await bookingsApi.getById(orderId);
        setOrder(data);
        // ...
    } catch (error) {
        console.error("❌ Failed to fetch order:", error);
        setError(error instanceof Error ? error.message : 'فشل في تحميل الطلب');
    }
};

// Render error screen:
if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-20 h-20 text-red-500" />
        <h1 className="text-2xl font-bold">حدث خطأ في تحميل الطلب</h1>
        <p className="text-red-600 font-mono text-sm">{error}</p>
        <Button onClick={() => window.location.reload()}>إعادة محاولة</Button>
    </div>
);

// Benefits:
// ✅ User sees error on screen
// ✅ Can retry
// ✅ Detailed error message
```

---

## Code Comparison Summary

| Aspect | Before | After | Change |
|--------|--------|-------|--------|
| States | 5 | 5 | Restructured |
| Add Items | Modal in page | Redirect | Simplified |
| Edit Items | Not available | Full modal | New feature |
| Validation | Scattered | Centralized | Organized |
| Permissions | 1 canModify | 3 separate | Clear |
| Error UI | None | Full screen | Better UX |
| Lines removed | - | ~50 | Cleaner |
| Lines added | - | ~150 | New features |
| **Net change** | - | **+100** | Worth it |

---

## Migration Checklist

If updating existing code:

- [ ] Add `error` state
- [ ] Remove `isAddingItems` state
- [ ] Remove `providerMenu` state
- [ ] Add `editingItem` state
- [ ] Add `canModifyOrder()` function
- [ ] Update Add Items button behavior
- [ ] Add Edit button next to items
- [ ] Add Edit modal
- [ ] Add Edit handler
- [ ] Update error rendering
- [ ] Remove provider menu loader useEffect
- [ ] Test all scenarios
- [ ] Deploy

