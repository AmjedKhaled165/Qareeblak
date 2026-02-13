"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Image as ImageIcon, Loader2, Check, CheckCheck, Camera, Maximize2, AlertCircle, ShoppingCart, MapPin, Phone as PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/ToastProvider";
import { useAppStore } from "@/components/providers/AppProvider";
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

interface PharmacyChatProps {
    isOpen: boolean;
    onClose: () => void;
    providerId: string;
    providerName: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE = API_URL.replace(/\/api$/, ''); // Ensure no trailing /api
const SOCKET_URL = API_BASE;

export function PharmacyChat({ isOpen, onClose, providerId, providerName }: PharmacyChatProps) {
    const { currentUser } = useAppStore();
    const { toast } = useToast();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [consultationId, setConsultationId] = useState<string | null>(null);
    const [isPharmacistOnline, setIsPharmacistOnline] = useState(true); // Forced Online as requested
    const [isTyping, setIsTyping] = useState(false);
    const [typingUserName, setTypingUserName] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [socketError, setSocketError] = useState<string | null>(null);
    // Order quote states
    const [acceptingQuote, setAcceptingQuote] = useState<{ messageId: number; items: any[]; totalPrice: number } | null>(null);
    const [addressArea, setAddressArea] = useState('');
    const [addressDetails, setAddressDetails] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [isAcceptingOrder, setIsAcceptingOrder] = useState(false);
    // Removed needsLogin state as requested

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Scroll to bottom when messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Initialize socket connection with proper error handling
    useEffect(() => {
        if (!isOpen) return;

        try {
            console.log('[PharmacyChat] Initializing Socket.io connection...');

            socketRef.current = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5,
            });

            socketRef.current.on('connect', () => {
                console.log('[PharmacyChat] Socket connected:', socketRef.current?.id);
                setSocketConnected(true);
                setSocketError(null);
            });

            socketRef.current.on('connect_error', (error: any) => {
                console.error('[PharmacyChat] Socket connection error:', error);
                setSocketError('خطأ في الاتصال بخادم المحادثة');
                setSocketConnected(false);
            });

            socketRef.current.on('disconnect', () => {
                console.log('[PharmacyChat] Socket disconnected');
                setSocketConnected(false);
            });

            socketRef.current.on('new-message', (message: Message) => {
                console.log('[PharmacyChat] New message received:', message);
                setMessages(prev => {
                    // Avoid duplicate messages
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            });

            socketRef.current.on('pharmacist-status', ({ providerId: pid, status }) => {
                console.log('[PharmacyChat] Pharmacist status update ignored (Forced Online):', pid, status);
                // logic commented out to force online
                // if (String(pid) === String(providerId)) {
                //     setIsPharmacistOnline(status === 'online');
                // }
            });

            socketRef.current.on('user-typing', ({ userName }) => {
                console.log('[PharmacyChat] User typing:', userName);
                setIsTyping(true);
                setTypingUserName(userName);
            });

            socketRef.current.on('user-stop-typing', () => {
                console.log('[PharmacyChat] User stopped typing');
                setIsTyping(false);
            });

            // Listen for read receipts
            socketRef.current.on('messages-read', ({ messageIds }: { messageIds: number[] }) => {
                console.log('[PharmacyChat] Messages marked as read:', messageIds);
                setMessages(prev => prev.map(msg =>
                    messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
                ));
            });

            return () => {
                if (socketRef.current) {
                    if (consultationId) {
                        socketRef.current.emit('leave-consultation', consultationId);
                    }
                    socketRef.current.disconnect();
                }
            };
        } catch (error) {
            console.error('[PharmacyChat] Socket initialization error:', error);
            setSocketError('فشل الاتصال بخادم المحادثة');
        }
    }, [isOpen, providerId, consultationId]);

    // Start or resume consultation
    useEffect(() => {
        if (!isOpen) return;

        const startConsultation = async () => {
            setIsLoading(true);
            setSocketError(null);

            // Step 1: Auto-login guest if no user
            let token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');

            if (!token) {
                console.log('[PharmacyChat] No token - creating guest account...');
                try {
                    const guestName = `زائر_${Math.floor(Math.random() * 10000)}`;
                    const { authApi } = await import('@/lib/api');
                    const res = await authApi.register(guestName, `${guestName}@guest.qareeblak.com`, 'guest123');
                    if (res && res.token) {
                        token = res.token;
                        toast("مرحباً! تم إنشاء حساب زائر", "success");
                    } else {
                        throw new Error('No token returned');
                    }
                } catch (e) {
                    console.error('[PharmacyChat] Guest login failed:', e);
                    toast("فشل في إنشاء حساب زائر", "error");
                    setIsLoading(false);
                    return;
                }
            }

            // Step 2: Start consultation
            console.log('[PharmacyChat] Starting consultation with provider:', providerId);
            try {
                const startUrl = `${API_BASE}/api/chat/start`;
                const startRes = await fetch(startUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ providerId }),
                });

                if (!startRes.ok) {
                    if (startRes.status === 401) {
                        localStorage.clear();
                        location.reload();
                    }
                    throw new Error(`Server error: ${startRes.status}`);
                }

                const startData = await startRes.json();
                if (startData.success && startData.consultationId) {
                    setConsultationId(startData.consultationId);
                    console.log('[PharmacyChat] Consultation ID:', startData.consultationId);

                    // Join socket room
                    if (socketRef.current) {
                        socketRef.current.emit('join-consultation', startData.consultationId);
                    }

                    // Fetch existing messages
                    const msgRes = await fetch(`${API_BASE}/api/chat/${startData.consultationId}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (msgRes.ok) {
                        const msgData = await msgRes.json();
                        if (msgData.success) {
                            setMessages(Array.isArray(msgData.messages) ? msgData.messages : []);
                        }
                    }
                } else {
                    toast(startData.error || "خطأ في بدء المحادثة", "error");
                }
            } catch (error) {
                console.error('[PharmacyChat] Error:', error);
                toast("حدث خطأ في الاتصال بالخادم", "error");
            } finally {
                setIsLoading(false);
            }
        };

        startConsultation();
    }, [isOpen, providerId, toast]);

    // Handle typing indicator
    const handleTyping = () => {
        if (!consultationId || !socketRef.current) return;

        socketRef.current.emit('typing', {
            consultationId,
            userId: currentUser?.id,
            userName: currentUser?.name || 'عميل',
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit('stop-typing', {
                consultationId,
                userId: currentUser?.id,
            });
        }, 2000);
    };

    // Send message
    const sendMessage = async (imageUrl?: string) => {
        if (!consultationId) {
            console.error('[PharmacyChat] Cannot send - no consultation ID');
            console.log('[PharmacyChat] Current state:', { consultationId, isLoading });
            toast("يرجى الانتظار قليلاً حتى يتم إعداد المحادثة...", "error");
            return;
        }

        if (!inputMessage.trim() && !imageUrl) {
            return;
        }

        setIsSending(true);
        console.log('[PharmacyChat] Sending message...', {
            consultationId,
            hasMessage: !!inputMessage.trim(),
            hasImage: !!imageUrl
        });

        try {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
            if (!token) {
                throw new Error('غير مصرح - لم يتم العثور على جلسة');
            }

            const messageUrl = `${API_BASE}/api/chat/${consultationId}/messages`;
            console.log('[PharmacyChat] Sending to:', messageUrl);

            const res = await fetch(messageUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: inputMessage.trim() || null,
                    imageUrl: imageUrl || null,
                    senderType: 'customer',
                    senderId: currentUser?.id,
                    senderName: currentUser?.name || 'عميل',
                }),
            });

            console.log('[PharmacyChat] Response status:', res.status);

            if (!res.ok) {
                const errorText = await res.text();
                console.error('[PharmacyChat] Error response:', errorText);
                throw new Error(`خطأ في الخادم: ${res.status}`);
            }

            // Check content type before parsing JSON
            const resContentType = res.headers.get('content-type');
            if (!resContentType || !resContentType.includes('application/json')) {
                console.error('[PharmacyChat] Non-JSON response from send');
                throw new Error('خطأ: الخادم لم يرد بصيغة JSON صحيحة');
            }

            let data;
            try {
                data = await res.json();
            } catch (parseError) {
                console.error('[PharmacyChat] JSON parse error:', parseError);
                throw new Error('خطأ: لا يمكن قراءة رد الخادم');
            }
            console.log('[PharmacyChat] Send response:', data);

            if (data.success) {
                // Add message to UI immediately (optimistic update)
                const optimisticMessage = {
                    id: data.message?.id || Date.now(),
                    consultation_id: consultationId,
                    sender_id: currentUser?.id || 0,
                    sender_type: 'customer' as const,
                    message: inputMessage.trim() || null,
                    image_url: imageUrl || null,
                    sender_name: currentUser?.name || 'أنا',
                    created_at: new Date().toISOString(),
                    is_read: false
                };
                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === optimisticMessage.id)) return prev;
                    return [...prev, optimisticMessage];
                });
                setInputMessage("");
                setPreviewImage(null);
                console.log('[PharmacyChat] Message sent successfully');
            } else {
                console.error('[PharmacyChat] Send failed:', data.error);
                toast(data.error || "فشل إرسال الرسالة", "error");
            }
        } catch (error) {
            console.error('[PharmacyChat] Error sending message:', error);
            const errorMsg = error instanceof Error ? error.message : "حدث خطأ في إرسال الرسالة";
            toast(errorMsg, "error");
        } finally {
            setIsSending(false);
        }
    };

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast("حجم الصورة كبير جداً (الحد الأقصى 5MB)", "error");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Send image
    const handleSendImage = () => {
        if (previewImage) {
            sendMessage(previewImage);
        }
    };

    // Format time
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
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

    // Accept order quote
    const acceptQuote = async () => {
        if (!acceptingQuote || !consultationId) return;

        if (!addressArea.trim()) {
            toast("يرجى إدخال العنوان", "error");
            return;
        }

        setIsAcceptingOrder(true);
        try {
            const token = localStorage.getItem('qareeblak_token') || localStorage.getItem('token') || localStorage.getItem('halan_token');
            if (!token) {
                toast("يرجى تسجيل الدخول أولاً", "error");
                return;
            }

            const res = await fetch(`${API_BASE}/api/chat/${consultationId}/accept-quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messageId: acceptingQuote.messageId,
                    addressArea: addressArea.trim(),
                    addressDetails: addressDetails.trim(),
                    phone: customerPhone.trim() || currentUser?.phone || '',
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast("تم إنشاء الطلب بنجاح! ✅ يمكنك متابعته من طلباتي", "success");
                setAcceptingQuote(null);
                setAddressArea('');
                setAddressDetails('');
                setCustomerPhone('');
                // Refresh messages to show updated quote status
                const msgRes = await fetch(`${API_BASE}/api/chat/${consultationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (msgRes.ok) {
                    const msgData = await msgRes.json();
                    if (msgData.success) {
                        setMessages(msgData.messages || []);
                    }
                }
            } else {
                toast(data.error || "فشل في قبول العرض", "error");
            }
        } catch (error) {
            console.error('[PharmacyChat] Accept quote error:', error);
            toast("حدث خطأ في قبول العرض", "error");
        } finally {
            setIsAcceptingOrder(false);
        }
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
                className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
            >
                {/* Header */}
                <div className="p-4 bg-gradient-to-l from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition" title="إغلاق الدردشة" aria-label="إغلاق نافذة الدردشة">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="text-center flex-1">
                        <h3 className="font-bold text-lg">{providerName}</h3>
                        <div className="flex items-center justify-center gap-2 text-sm opacity-90">
                            <span className={`w-2 h-2 rounded-full ${isPharmacistOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                            {isPharmacistOnline ? 'متصل الآن' : 'غير متصل'}
                        </div>
                    </div>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
                    {/* Socket Error Alert */}
                    {socketError && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 p-3 rounded-lg flex items-start gap-2"
                        >
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">{socketError}</div>
                        </motion.div>
                    )}

                    {/* Loading State removed/minimized */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                                <p className="text-sm text-slate-600 dark:text-slate-400">جاري تحميل المحادثة...</p>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                <Send className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="font-bold">مرحباً بك!</p>
                            <p className="text-sm mt-1">ابدأ محادثتك مع الصيدلية</p>
                            <p className="text-xs mt-2 text-slate-400">يمكنك إرسال صورة الروشتة أو السؤال عن الأدوية</p>
                        </div>
                    ) : (
                        <>
                            {(Array.isArray(messages) ? messages : []).map((msg) => {
                                // System message
                                if (msg.message_type === 'system') {
                                    return (
                                        <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                                            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs px-4 py-2 rounded-full max-w-[90%] text-center">
                                                {msg.message}
                                            </div>
                                        </motion.div>
                                    );
                                }

                                // Order quote card (from provider)
                                if (msg.message_type === 'order_quote') {
                                    const quoteData = parseQuoteData(msg.message);
                                    if (!quoteData) return null;
                                    const isAccepted = quoteData.status === 'accepted';
                                    return (
                                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                                            <div className="max-w-[90%] w-full rounded-2xl overflow-hidden shadow-lg border border-emerald-200 dark:border-emerald-800">
                                                {/* Header */}
                                                <div className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-center gap-2">
                                                    <ShoppingCart className="w-5 h-5" />
                                                    <span className="font-bold">عرض سعر من الصيدلية</span>
                                                    {isAccepted && (
                                                        <span className="mr-auto bg-white/20 text-xs px-2 py-1 rounded-full">✅ تم القبول</span>
                                                    )}
                                                </div>
                                                {/* Items */}
                                                <div className="bg-white dark:bg-slate-800 p-4 space-y-3">
                                                    {quoteData.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                                                            <span className="font-bold text-emerald-600">{item.price} ج.م</span>
                                                        </div>
                                                    ))}
                                                    <div className="border-t-2 border-emerald-200 dark:border-emerald-800 pt-3 flex justify-between items-center">
                                                        <span className="font-bold text-slate-900 dark:text-white text-base">الإجمالي</span>
                                                        <span className="font-black text-xl text-emerald-600">{quoteData.totalPrice} ج.م</span>
                                                    </div>
                                                </div>
                                                {/* Accept Button */}
                                                {!isAccepted ? (
                                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50">
                                                        <button
                                                            onClick={() => setAcceptingQuote({
                                                                messageId: msg.id,
                                                                items: quoteData.items,
                                                                totalPrice: quoteData.totalPrice
                                                            })}
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-base"
                                                        >
                                                            <ShoppingCart className="w-5 h-5" />
                                                            إضافة للسلة وإتمام الطلب
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-center">
                                                        <span className="text-sm text-emerald-600 font-bold">✅ تم قبول العرض - طلب #{quoteData.bookingId}</span>
                                                    </div>
                                                )}
                                                <div className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900">
                                                    {formatTime(msg.created_at)}
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
                                        className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl p-3 ${msg.sender_type === 'customer'
                                                ? 'bg-emerald-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none shadow-sm'
                                                }`}
                                        >
                                            {msg.image_url && (
                                                <div className="mb-2 cursor-pointer relative group" onClick={() => setZoomedImage(msg.image_url)}>
                                                    <img src={msg.image_url} alt="صورة" className="rounded-lg max-h-48 w-auto"
                                                        onError={(e) => { (e.target as HTMLImageElement).classList.add('hidden'); }} />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                                                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
                                                    </div>
                                                </div>
                                            )}
                                            {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                                            <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.sender_type === 'customer' ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                                                <span>{formatTime(msg.created_at)}</span>
                                                {msg.sender_type === 'customer' && (
                                                    <CheckCheck className={`w-3 h-3 ${msg.is_read ? 'text-blue-400' : ''}`} />
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

                {/* Image Preview */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className="relative">
                                    <img
                                        src={previewImage}
                                        alt="معاينة"
                                        className="h-20 w-auto rounded-lg object-cover"
                                    />
                                    <button
                                        onClick={() => setPreviewImage(null)}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">صورة جاهزة للإرسال</p>
                                    <p className="text-xs text-slate-500">يمكنك إضافة تعليق أو إرسالها مباشرة</p>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={handleSendImage}
                                    disabled={isSending}
                                >
                                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    {/* Removed "Preparing conversation" overlay */}

                    <div className="flex items-end gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelect}
                            title="إرفاق صورة"
                            aria-label="إرفاق صورة الروشتة"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!consultationId || isLoading || isSending}
                            className={`p-3 rounded-xl transition ${consultationId && !isLoading && !isSending
                                ? 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed opacity-50'
                                }`}
                            title={consultationId ? "إرفاق صورة الروشتة" : "جاري بدء المحادثة..."}
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                value={inputMessage}
                                onChange={(e) => {
                                    setInputMessage(e.target.value);
                                    if (consultationId) {
                                        handleTyping();
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && consultationId && !isSending && !isLoading) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                disabled={!consultationId || isLoading}
                                placeholder={consultationId ? "اكتب رسالتك أو أرسل صورة الروشتة..." : "جاري بدء المحادثة..."}
                                className={`w-full resize-none rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 max-h-32 ${consultationId && !isLoading
                                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-emerald-500'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-50'
                                    }`}
                                rows={1}
                            />
                        </div>
                        <Button
                            size="icon"
                            className="bg-emerald-600 hover:bg-emerald-700 h-11 w-11 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => sendMessage()}
                            disabled={!consultationId || isLoading || isSending || (!inputMessage.trim() && !previewImage)}
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

            {/* Accept Quote Dialog */}
            <AnimatePresence>
                {acceptingQuote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
                        onClick={() => setAcceptingQuote(null)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-emerald-600" />
                                    تأكيد الطلب
                                </h3>
                                <button onClick={() => setAcceptingQuote(null)} className="text-slate-400 hover:text-slate-600" title="إغلاق التنبيه" aria-label="إغلاق نافذة تأكيد الطلب">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Order Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
                                {acceptingQuote.items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{item.name}</span>
                                        <span className="font-bold text-emerald-600">{item.price} ج.م</span>
                                    </div>
                                ))}
                                <div className="border-t pt-2 flex justify-between font-bold">
                                    <span>الإجمالي</span>
                                    <span className="text-emerald-600 text-lg">{acceptingQuote.totalPrice} ج.م</span>
                                </div>
                            </div>

                            {/* Address Input */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                                        <MapPin className="w-4 h-4 text-emerald-600" />
                                        المنطقة / الحي *
                                    </label>
                                    <input
                                        type="text"
                                        value={addressArea}
                                        onChange={(e) => setAddressArea(e.target.value)}
                                        placeholder="مثال: حي الأربعين، أسيوط"
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">تفاصيل العنوان</label>
                                    <input
                                        type="text"
                                        value={addressDetails}
                                        onChange={(e) => setAddressDetails(e.target.value)}
                                        placeholder="رقم المبنى، الشارع، علامة مميزة..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                                        <PhoneIcon className="w-4 h-4 text-emerald-600" />
                                        رقم الهاتف
                                    </label>
                                    <input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder={currentUser?.phone || "01xxxxxxxxx"}
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* Confirm Button */}
                            <Button
                                onClick={acceptQuote}
                                disabled={isAcceptingOrder || !addressArea.trim()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 h-12 rounded-xl text-base disabled:opacity-50"
                            >
                                {isAcceptingOrder ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <ShoppingCart className="w-5 h-5 ml-2" />
                                        تأكيد الطلب ({acceptingQuote.totalPrice} ج.م)
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <img
                            src={zoomedImage}
                            alt="صورة مكبرة"
                            className="max-w-full max-h-full object-contain rounded-lg"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
