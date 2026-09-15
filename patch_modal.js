const fs = require('fs');
const file = 'src/app/provider-dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace state
content = content.replace(
    /const \[createOrderItems, setCreateOrderItems\][\s\S]*?setCreateDeliveryAddress\(''\);/,
    `const [createOrdersList, setCreateOrdersList] = useState<{ id: string; customerPhone: string; deliveryAddress: string; items: { name: string; price: string; quantity: string }[] }[]>([{ id: 'initial', customerPhone: '', deliveryAddress: '', items: [{ name: '', price: '', quantity: '1' }] }]);\n    const [isCreatingOrder, setIsCreatingOrder] = useState(false);`
);

// 2. Replace onClick
content = content.replace(
    /setCreateOrderItems\(\[\{ name: '', price: '', quantity: '1' \}\]\);\s*setIsCreateOrderOpen\(true\);/,
    `setCreateOrdersList([{ id: Math.random().toString(), customerPhone: '', deliveryAddress: '', items: [{ name: '', price: '', quantity: '1' }] }]);\n                                            setIsCreateOrderOpen(true);`
);

// 3. Replace Modal Body
const modalStart = `<div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">`;
const modalEnd = `</DialogContent>`;

const modalReplacement = `<div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto">
                        {createOrdersList.map((order, orderIndex) => (
                            <div key={order.id} className="space-y-6 relative border border-primary/20 bg-primary/5 rounded-2xl p-4">
                                {createOrdersList.length > 1 && (
                                    <div className="flex justify-between items-center mb-2 border-b border-primary/10 pb-2">
                                        <h4 className="font-bold text-primary">طلب رقم {orderIndex + 1}</h4>
                                        <button 
                                            onClick={() => setCreateOrdersList(createOrdersList.filter((_, i) => i !== orderIndex))}
                                            className="text-destructive text-sm font-bold hover:underline"
                                        >
                                            حذف الطلب
                                        </button>
                                    </div>
                                )}
                                <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-border/50 bg-card">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-xs font-bold text-muted-foreground">رقم تليفون العميل</Label>
                                        <Input 
                                            placeholder="مثال: 01012345678" 
                                            value={order.customerPhone}
                                            onChange={(e) => {
                                                const newList = [...createOrdersList];
                                                newList[orderIndex].customerPhone = e.target.value;
                                                setCreateOrdersList(newList);
                                            }}
                                            className="h-11 rounded-xl bg-background border-border text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-xs font-bold text-muted-foreground">العنوان بالتفصيل</Label>
                                        <Input 
                                            placeholder="شارع المحطة، عمارة 5..." 
                                            value={order.deliveryAddress}
                                            onChange={(e) => {
                                                const newList = [...createOrdersList];
                                                newList[orderIndex].deliveryAddress = e.target.value;
                                                setCreateOrdersList(newList);
                                            }}
                                            className="h-11 rounded-xl bg-background border-border"
                                        />
                                    </div>
                                </div>

                                {order.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-border/50 bg-muted/10 relative group">
                                        <div className="flex-1 space-y-2 relative">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold text-muted-foreground">اسم الصنف / الخدمة</Label>
                                                {myServices.length > 0 && (
                                                    <select 
                                                        className="text-[10px] sm:text-xs bg-primary/10 text-primary font-bold rounded px-1.5 py-0.5 border-none outline-none cursor-pointer max-w-[120px] sm:max-w-[150px] truncate"
                                                        onChange={(e) => {
                                                            const selected = myServices.find(s => String(s.id) === e.target.value);
                                                            if (selected) {
                                                                const newList = [...createOrdersList];
                                                                newList[orderIndex].items[itemIndex].name = selected.name;
                                                                newList[orderIndex].items[itemIndex].price = String(selected.price);
                                                                setCreateOrdersList(newList);
                                                                e.target.value = "";
                                                            }
                                                        }}
                                                        title="اختر من القائمة المضافة مسبقاً"
                                                    >
                                                        <option value="">+ اختر من خدماتك</option>
                                                        {myServices.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name} ({s.price} ج)</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="مثال: بيتزا مارجريتا (أو اختر من القائمة)" 
                                                value={item.name}
                                                onChange={(e) => {
                                                    const newList = [...createOrdersList];
                                                    newList[orderIndex].items[itemIndex].name = e.target.value;
                                                    setCreateOrdersList(newList);
                                                }}
                                                className="h-11 rounded-xl bg-background border-border"
                                            />
                                        </div>
                                        <div className="w-full md:w-32 space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">السعر (ج.م)</Label>
                                            <Input 
                                                type="number" 
                                                placeholder="0.00" 
                                                min="0"
                                                value={item.price}
                                                onChange={(e) => {
                                                    const newList = [...createOrdersList];
                                                    newList[orderIndex].items[itemIndex].price = e.target.value;
                                                    setCreateOrdersList(newList);
                                                }}
                                                className="h-11 rounded-xl bg-background border-border text-left"
                                            />
                                        </div>
                                        <div className="w-full md:w-24 space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">الكمية</Label>
                                            <Input 
                                                type="number" 
                                                placeholder="1" 
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const newList = [...createOrdersList];
                                                    newList[orderIndex].items[itemIndex].quantity = e.target.value;
                                                    setCreateOrdersList(newList);
                                                }}
                                                className="h-11 rounded-xl bg-background border-border text-center"
                                            />
                                        </div>
                                        {order.items.length > 1 && (
                                            <button 
                                                onClick={() => {
                                                    const newList = [...createOrdersList];
                                                    newList[orderIndex].items = newList[orderIndex].items.filter((_, i) => i !== itemIndex);
                                                    setCreateOrdersList(newList);
                                                }}
                                                className="absolute -top-3 -right-3 md:top-auto md:-right-4 md:bottom-2 w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        const newList = [...createOrdersList];
                                        newList[orderIndex].items.push({ name: '', price: '', quantity: '1' });
                                        setCreateOrdersList(newList);
                                    }}
                                    className="w-full h-12 rounded-xl border-dashed border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary font-bold gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة صنف آخر
                                </Button>

                                <div className="flex justify-between items-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                                    <span className="font-bold text-foreground">إجمالي الطلب:</span>
                                    <span className="text-xl font-black text-primary">
                                        {order.items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0).toFixed(2)} ج.م
                                    </span>
                                </div>
                            </div>
                        ))}

                        <Button 
                            variant="secondary" 
                            onClick={() => {
                                setCreateOrdersList([...createOrdersList, { id: Math.random().toString(), customerPhone: '', deliveryAddress: '', items: [{ name: '', price: '', quantity: '1' }] }]);
                            }}
                            className="w-full h-14 rounded-xl border-dashed border-2 border-emerald-500/30 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500 font-bold gap-2 shadow-sm"
                        >
                            <PackagePlus className="w-5 h-5" />
                            إضافة طلب آخر (لعميل جديد)
                        </Button>
                    </div>

                    <DialogFooter className="p-6 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row gap-3 sm:justify-start">
                        <Button 
                            className="bg-primary hover:bg-primary/90 text-white rounded-xl h-14 px-8 font-black flex-1 shadow-lg shadow-primary/20 transition-all active:scale-95 gap-2 text-lg"
                            disabled={isCreatingOrder || createOrdersList.some(o => !o.customerPhone || !o.deliveryAddress || o.items.some(i => !i.name.trim() || !i.price || Number(i.price) <= 0))}
                            onClick={async () => {
                                setIsCreatingOrder(true);
                                try {
                                    await Promise.all(createOrdersList.map(order => {
                                        const items = order.items.map(i => ({
                                            name: i.name,
                                            price: Number(i.price),
                                            quantity: Number(i.quantity) || 1
                                        }));
                                        return providerOrdersApi.create({ 
                                            items, 
                                            customerPhone: order.customerPhone, 
                                            deliveryAddress: order.deliveryAddress 
                                        });
                                    }));
                                    
                                    toast(\`تم إنشاء \${createOrdersList.length} طلب بنجاح ✅\`, 'success');
                                    setIsCreateOrderOpen(false);
                                    setCreateOrdersList([{ id: 'initial', customerPhone: '', deliveryAddress: '', items: [{ name: '', price: '', quantity: '1' }] }]);
                                    
                                    if (providerId) fetchPaginatedBookings();
                                } catch (err: any) {
                                    toast(err?.message || 'حدث خطأ في إنشاء بعض الطلبات', 'error');
                                } finally {
                                    setIsCreatingOrder(false);
                                }
                            }}
                        >
                            {isCreatingOrder ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            {createOrdersList.length > 1 ? \`تأكيد وإرسال \${createOrdersList.length} طلبات\` : "تأكيد الطلب"}
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => setIsCreateOrderOpen(false)}
                            className="rounded-xl h-14 px-8 font-bold border-border/50 hover:bg-muted text-muted-foreground flex-1 sm:flex-none text-lg"
                        >
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>`;

const startIdx = content.indexOf(modalStart);
const endIdx = content.indexOf(modalEnd, startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + modalReplacement + content.slice(endIdx + modalEnd.length);
    fs.writeFileSync(file, content);
    console.log("Success");
} else {
    console.log("Failed to find modal boundaries.");
}
