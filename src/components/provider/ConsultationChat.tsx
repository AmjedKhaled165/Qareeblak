"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Check, CheckCheck, Maximize2, Phone, User, ShoppingBag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/ToastProvider";
import { io, Socket } from "socket.io-client";

interface Message {
    id: number;
    consultation_id: string;
    sender_id: number;
    sender_type: 'customer' | 'pharmacist';
    sender_name?: string;
    message: string | null;
    message_type?: 'text' | 'order_quote' | 'system';
    image_url: string | null;
    is_read: boolean;
    created_at: string;
}

interface Consultation {
    id: string;
    customer_id: number;
    provider_id: number;
    customer_name?: string;
    customer_phone?: string;
    status: 'active' | 'closed' | 'converted_to_order';
    unread_count?: number;
    last_message?: string;
    last_message_time?: string;
}

interface ConsultationChatProps {
    isOpen: boolean;
    onClose: () => void;
    consultation: Consultation;
    providerId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = API_URL.replace(/\/api$/, ''); // Ensure no trailing /api
const SOCKET_URL = API_BASE;

export function ConsultationChat({ isOpen, onClose, consultation, providerId }: ConsultationChatProps) {
    const { toast } = useToast();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUserName, setTypingUserName] = useState("");
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [quoteItems, setQuoteItems] = useState<{ name: string; price: string }[]>([{ name: '', price: '' }]);
    const [isSendingQuote, setIsSendingQuote] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Scroll to bottom when messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Initialize socket connection
    useEffect(() => {
        if (!isOpen) return;

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
        });

        // Join consultation room
        socketRef.current.emit('join-consultation', consultation.id);
        socketRef.current.emit('pharmacist-online', providerId);

        socketRef.current.on('new-message', (message: Message) => {
            setMessages(prev => [...prev, message]);
            // Mark as read since we're viewing
            markAsRead();
        });

        socketRef.current.on('user-typing', ({ userName }) => {
            setIsTyping(true);
            setTypingUserName(userName);
        });

        socketRef.current.on('user-stop-typing', () => {
            setIsTyping(false);
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('leave-consultation', consultation.id);
                socketRef.current.emit('pharmacist-offline', providerId);
                socketRef.current.disconnect();
            }
        };
    }, [isOpen, consultation.id, providerId]);

    // Fetch messages
    useEffect(() => {
        if (!isOpen) return;

        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
                if (!token) {
                    console.error('[ConsultationChat] No token found (tried: qareeblak_token, token, halan_token)');
                    setIsLoading(false);
                    return;
                }

                const res = await fetch(`${API_BASE}/api/chat/${consultation.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });

                if (!res.ok) {
                    console.error('[ConsultationChat] Failed to fetch messages:', res.status);

                    // If 401, token is invalid - clear and reload
                    if (res.status === 401) {
                        console.warn('[ConsultationChat] Token invalid (401). Clearing localStorage.');
                        localStorage.clear();
                        location.reload();
                    }

                    setIsLoading(false);
                    return;
                }

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    console.error('[ConsultationChat] Non-JSON response');
                    setIsLoading(false);
                    return;
                }

                try {
                    const data = await res.json();
                    if (data.success) {
                        setMessages(data.messages || []);
                        markAsRead();
                    }
                } catch (parseError) {
                    console.error('[ConsultationChat] JSON parse error:', parseError);
                }
            } catch (error) {
                console.error('[ConsultationChat] Error fetching messages:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();
    }, [isOpen, consultation.id]);

    // Mark messages as read
    const markAsRead = async () => {
        try {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
            if (!token) return;

            const res = await fetch(`${API_BASE}/api/chat/${consultation.id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!res.ok) {
                console.error('[ConsultationChat] Failed to mark as read:', res.status);
                return;
            }
        } catch (error) {
            console.error('[ConsultationChat] Error marking as read:', error);
        }
    };

    // Handle typing indicator
    const handleTyping = () => {
        if (!socketRef.current) return;

        socketRef.current.emit('typing', {
            consultationId: consultation.id,
            userId: providerId,
            userName: 'الصيدلي',
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit('stop-typing', {
                consultationId: consultation.id,
                userId: providerId,
            });
        }, 2000);
    };

    // Send message
    const sendMessage = async () => {
        console.log('[ConsultationChat] sendMessage called. Input:', inputMessage);
        if (!inputMessage.trim()) {
            console.log('[ConsultationChat] Input is empty');
            return;
        }

        setIsSending(true);
        try {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
            if (!token) {
                toast("يرجى تسجيل الدخول أولاً", "error");
                setIsSending(false);
                return;
            }

            console.log('[ConsultationChat] Sending message to:', `${API_BASE}/api/chat/${consultation.id}/messages`);

            const res = await fetch(`${API_BASE}/api/chat/${consultation.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: inputMessage.trim(),
                    senderType: 'pharmacist',
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('[ConsultationChat] Send failed:', res.status, errorText);

                // If 401, token is invalid - clear and reload
                if (res.status === 401) {
                    console.warn('[ConsultationChat] Token invalid (401). Clearing localStorage.');
                    localStorage.clear();
                    location.reload();
                }

                toast(`خطأ من الخادم: ${res.status}`, "error");
                setIsSending(false);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('[ConsultationChat] Non-JSON response from send');
                toast("خطأ: الخادم لم يرد بصيغة JSON صحيحة", "error");
                setIsSending(false);
                return;
            }

            try {
                const data = await res.json();
                if (data.success) {
                    setInputMessage("");
                    console.log('[ConsultationChat] Message sent successfully');
                } else {
                    toast(data.error || "فشل إرسال الرسالة", "error");
                    console.error('[ConsultationChat] Send failed:', data.error);
                }
            } catch (parseError) {
                console.error('[ConsultationChat] JSON parse error:', parseError);
                toast("خطأ: لا يمكن قراءة رد الخادم", "error");
            }
        } catch (error) {
            console.error('[ConsultationChat] Error sending message:', error);
            toast("حدث خطأ في إرسال الرسالة", "error");
        } finally {
            setIsSending(false);
        }
    };

    // Send order quote
    const sendQuote = async () => {
        const validItems = quoteItems.filter(item => item.name.trim() && Number(item.price) > 0);
        if (validItems.length === 0) {
            toast("يجب إضافة منتج واحد على الأقل مع السعر", "error");
            return;
        }

        setIsSendingQuote(true);
        try {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
            if (!token) {
                toast("يرجى تسجيل الدخول أولاً", "error");
                return;
            }

            const res = await fetch(`${API_BASE}/api/chat/${consultation.id}/quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    items: validItems.map(item => ({ name: item.name.trim(), price: Number(item.price) }))
                }),
            });

            const data = await res.json();
            if (data.success) {
                setShowQuoteForm(false);
                setQuoteItems([{ name: '', price: '' }]);
                toast("تم إرسال عرض السعر للعميل ✅", "success");
            } else {
                toast(data.error || "فشل إرسال العرض", "error");
            }
        } catch (error) {
            console.error('[ConsultationChat] Quote error:', error);
            toast("حدث خطأ في إرسال العرض", "error");
        } finally {
            setIsSendingQuote(false);
        }
    };

    // Parse quote data from message
    const parseQuoteData = (message: string | null) => {
        if (!message) return null;
        try {
            return JSON.parse(message);
        } catch {
            return null;
        }
    };

    // Format time
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Chat Panel */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
            >
                {/* Header */}
                <div className="p-4 bg-gradient-to-l from-emerald-600 to-teal-600 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition" title="إغلاق المحادثة" aria-label="إغلاق نافذة المحادثة">
                            <X className="w-5 h-5" />
                        </button>
                        <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                            استشارة #{consultation.id.slice(-6)}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{consultation.customer_name || 'عميل'}</h3>
                            {consultation.customer_phone && (
                                <a href={"tel:" + consultation.customer_phone} className="flex items-center gap-1 text-sm opacity-90 hover:opacity-100">
                                    <Phone className="w-3 h-3" />
                                    {consultation.customer_phone}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>لا توجد رسائل بعد</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg) => {
                                // System message
                                if (msg.message_type === 'system') {
                                    return (
                                        <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                                            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs px-4 py-2 rounded-full">
                                                {msg.message}
                                            </div>
                                        </motion.div>
                                    );
                                }

                                // Order quote message
                                if (msg.message_type === 'order_quote') {
                                    const quoteData = parseQuoteData(msg.message);
                                    if (!quoteData) return null;
                                    return (
                                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                                            <div className="max-w-[85%] rounded-2xl overflow-hidden shadow-lg border border-emerald-200 dark:border-emerald-800">
                                                <div className="bg-emerald-600 text-white px-4 py-2 flex items-center gap-2">
                                                    <ShoppingBag className="w-4 h-4" />
                                                    <span className="font-bold text-sm">عرض سعر</span>
                                                    {quoteData.status === 'accepted' && (
                                                        <span className="mr-auto bg-white/20 text-xs px-2 py-0.5 rounded-full">✅ مقبول</span>
                                                    )}
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-3 space-y-2">
                                                    {quoteData.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                                                            <span className="font-bold text-emerald-600">{item.price} ج.م</span>
                                                        </div>
                                                    ))}
                                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                                                        <span className="font-bold text-slate-900 dark:text-white">الإجمالي</span>
                                                        <span className="font-black text-lg text-emerald-600">{quoteData.totalPrice} ج.م</span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-[10px] text-slate-400 text-left">
                                                    {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                    {msg.is_read ? <CheckCheck className="w-3 h-3 inline mr-1" /> : <Check className="w-3 h-3 inline mr-1" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                }

                                // Normal message
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.sender_type === 'pharmacist' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl p-3 ${msg.sender_type === 'pharmacist'
                                                ? 'bg-emerald-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none shadow-sm'
                                                }`}
                                        >
                                            {msg.sender_type === 'customer' && msg.sender_name && (
                                                <p className="text-xs font-bold text-emerald-600 mb-1">{msg.sender_name}</p>
                                            )}
                                            {msg.image_url && (
                                                <div className="mb-2 cursor-pointer relative group" onClick={() => setZoomedImage(msg.image_url)}>
                                                    <img src={msg.image_url} alt="صورة" className="rounded-lg max-h-64 w-auto border-2 border-white/20" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                                                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
                                                    </div>
                                                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">📷 صورة الروشتة</span>
                                                </div>
                                            )}
                                            {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                                            <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.sender_type === 'pharmacist' ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                                                <span>{new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                {msg.sender_type === 'pharmacist' && (
                                                    msg.is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {/* Typing indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none p-3 shadow-sm">
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:0ms]" />
                                            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:150ms]" />
                                            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:300ms]" />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">{typingUserName} يكتب...</p>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Quote Form */}
                <AnimatePresence>
                    {showQuoteForm && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 overflow-hidden"
                        >
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                        <ShoppingBag className="w-4 h-4" />
                                        إنشاء عرض طلب
                                    </h4>
                                    <button onClick={() => { setShowQuoteForm(false); setQuoteItems([{ name: '', price: '' }]); }}
                                        className="text-slate-400 hover:text-red-500 transition"
                                        title="إغلاق النموذج"
                                        aria-label="إغلاق نموذج عرض السعر"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {quoteItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => {
                                                    const newItems = [...quoteItems];
                                                    newItems[idx].name = e.target.value;
                                                    setQuoteItems(newItems);
                                                }}
                                                placeholder="اسم المنتج"
                                                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => {
                                                    const newItems = [...quoteItems];
                                                    newItems[idx].price = e.target.value;
                                                    setQuoteItems(newItems);
                                                }}
                                                placeholder="السعر"
                                                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <span className="text-xs text-slate-400">ج.م</span>
                                            {quoteItems.length > 1 && (
                                                <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-600 transition p-1"
                                                    title="حذف المنتج"
                                                    aria-label={`حذف المنتج ${item.name}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setQuoteItems([...quoteItems, { name: '', price: '' }])}
                                    className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 transition"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة منتج آخر
                                </button>

                                {quoteItems.some(i => i.name && Number(i.price) > 0) && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-sm flex justify-between items-center border border-slate-200 dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-400">الإجمالي:</span>
                                        <span className="font-black text-emerald-600 text-lg">
                                            {quoteItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0)} ج.م
                                        </span>
                                    </div>
                                )}

                                <Button
                                    onClick={sendQuote}
                                    disabled={isSendingQuote || !quoteItems.some(i => i.name.trim() && Number(i.price) > 0)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold"
                                >
                                    {isSendingQuote ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال العرض للعميل'}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-end gap-2">
                        {/* Create Quote Button */}
                        <button
                            onClick={() => setShowQuoteForm(!showQuoteForm)}
                            className={`p-3 rounded-xl transition ${showQuoteForm
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            title="إنشاء عرض طلب"
                        >
                            <ShoppingBag className="w-5 h-5" />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                value={inputMessage}
                                onChange={(e) => {
                                    setInputMessage(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="اكتب ردك للعميل..."
                                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
                                rows={1}
                            />
                        </div>
                        <Button
                            size="icon"
                            className="bg-emerald-600 hover:bg-emerald-700 h-11 w-11 rounded-xl"
                            onClick={sendMessage}
                            disabled={isSending || !inputMessage.trim()}
                        >
                            {isSending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Image Zoom Modal */}
            <AnimatePresence>
                {zoomedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                        onClick={() => setZoomedImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30"
                            onClick={() => setZoomedImage(null)}
                            title="إغلاق الصورة"
                            aria-label="إغلاق الصورة المكبرة"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="text-center">
                            <img
                                src={zoomedImage}
                                alt="صورة مكبرة"
                                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                            />
                            <p className="text-white mt-4 text-sm opacity-75">📷 صورة الروشتة من العميل</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
