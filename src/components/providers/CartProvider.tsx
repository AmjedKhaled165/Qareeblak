"use client";

import { createContext, useState, useEffect, ReactNode, useContext } from "react";
import { bookingsApi, apiCall } from "@/lib/api";
import { useToast } from "./ToastProvider";

export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    providerId: string;
    providerName: string;
    image?: string;
}

export interface CartContextType {
    // Global Cart Actions
    globalCart: CartItem[];
    addToGlobalCart: (item: CartItem) => void;
    removeFromGlobalCart: (providerId: string, itemId: string) => void;
    updateGlobalCartQuantity: (providerId: string, itemId: string, quantity: number) => void;
    clearGlobalCart: () => void;
    checkoutGlobalCart: (userId: string | number, addressInfo?: { area: string, details: string, phone: string }, userPrizeId?: number) => Promise<string[] | false>;
    isLoadingCart: boolean;

    // Info Cart Actions (For specific bookings)
    pendingCartItems: Record<string, any[]>;
    addToInfoCart: (orderId: string, item: any) => void;
    removeFromInfoCart: (orderId: string, itemIndex: number) => void;
    clearInfoCart: (orderId: string) => void;
    submitInfoCart: (orderId: string, providerId?: string, onSuccess?: () => void) => Promise<boolean>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [globalCart, setGlobalCart] = useState<CartItem[]>([]);
    const [pendingCartItems, setPendingCartItems] = useState<Record<string, any[]>>({});
    const [isLoadingCart, setIsLoadingCart] = useState(false);

    // Initial Load
    useEffect(() => {
        const savedCart = localStorage.getItem('qareeblak_cart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                if (Array.isArray(parsed)) {
                    const validItems = parsed.filter(i => i.id && i.providerId).map(i => ({
                        ...i,
                        id: String(i.id),
                        providerId: String(i.providerId)
                    }));
                    setGlobalCart(validItems);
                }
            } catch (e) {
                console.error("Failed to parse saved cart");
            }
        }
    }, []);

    // Save
    useEffect(() => {
        localStorage.setItem('qareeblak_cart', JSON.stringify(globalCart));
    }, [globalCart]);

    const addToGlobalCart = (item: CartItem) => {
        const normalizedItem = { ...item, id: String(item.id), providerId: String(item.providerId) };
        setGlobalCart(prev => {
            const existing = prev.find(i => i.id === normalizedItem.id && i.providerId === normalizedItem.providerId);
            if (existing) {
                toast("تم التعديل في السلة", "success");
                return prev.map(i => (i.id === normalizedItem.id && i.providerId === normalizedItem.providerId)
                    ? { ...i, quantity: i.quantity + normalizedItem.quantity }
                    : i
                );
            }
            toast("تمت الإضافة للسلة", "success");
            return [...prev, normalizedItem];
        });
    };

    const removeFromGlobalCart = (providerId: string, itemId: string) => {
        setGlobalCart(prev => prev.filter(i => !(i.id === String(itemId) && i.providerId === String(providerId))));
    };

    const updateGlobalCartQuantity = (providerId: string, itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromGlobalCart(providerId, itemId);
            return;
        }
        setGlobalCart(prev => prev.map(i => (i.id === itemId && i.providerId === providerId) ? { ...i, quantity } : i));
    };

    const clearGlobalCart = () => setGlobalCart([]);

    const checkoutGlobalCart = async (userId: string | number, addressInfo?: any, userPrizeId?: number) => {
        if (!userId || globalCart.length === 0) return false;

        // Block checkout for unauthenticated mock users
        if (String(userId) === '999' || userId === 999) {
            toast("يجب تسجيل الدخول أولاً لإتمام الطلب", "error");
            return false;
        }

        setIsLoadingCart(true);
        try {
            const result = await bookingsApi.checkout({
                userId,
                items: globalCart,
                addressInfo,
                userPrizeId
            });


            if (result && result.success) {
                clearGlobalCart();
                toast("تم تسجيل طلبك بنجاح!", "success");
                return result.parentId ? [`P${result.parentId}`] : (result.bookingIds || []);
            } else {
                toast(result.error || "عذراً، فشل إتمام الطلب! تأكد من اتصالك.", "error");
                return false;
            }
        } catch (error) {
            toast("حدث خطأ غير متوقع أثناء إتمام الطلب", "error");
            return false;
        } finally {
            setIsLoadingCart(false);
        }
    };

    const addToInfoCart = (orderId: string, item: any) => {
        setPendingCartItems(prev => ({ ...prev, [orderId]: [...(prev[orderId] || []), item] }));
        toast("تمت الإضافة لـ طلبات الإلحاق", "success");
    };

    const removeFromInfoCart = (orderId: string, itemIndex: number) => {
        setPendingCartItems(prev => {
            const newItems = [...(prev[orderId] || [])];
            newItems.splice(itemIndex, 1);
            return { ...prev, [orderId]: newItems };
        });
    };

    const clearInfoCart = (orderId: string) => {
        setPendingCartItems(prev => { const { [orderId]: removed, ...rest } = prev; return rest; });
    };

    const submitInfoCart = async (orderId: string, providerId?: string, onSuccess?: () => void) => {
        const items = pendingCartItems[orderId];
        if (!items || items.length === 0) return false;
        setIsLoadingCart(true);
        try {
            const response = await apiCall(`/halan/orders/${orderId}/customer-add-items-bulk`, {
                method: 'POST', body: JSON.stringify({ items, providerId })
            });

            if (!response.success && !response.items) throw new Error(response.error);
            clearInfoCart(orderId);
            toast("تم إرسال المنتجات المضافة للطلب بنجاح", "success");
            if (onSuccess) onSuccess();
            return true;
        } catch (error) {
            toast("فشل في رفع الطلبات الإضافية", "error");
            return false;
        } finally {
            setIsLoadingCart(false);
        }
    };

    return (
        <CartContext.Provider value={{
            globalCart, addToGlobalCart, removeFromGlobalCart, updateGlobalCartQuantity, clearGlobalCart, checkoutGlobalCart,
            pendingCartItems, addToInfoCart, removeFromInfoCart, clearInfoCart, submitInfoCart, isLoadingCart
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCartStore() {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCartStore must be used within a CartProvider");
    return context;
}
