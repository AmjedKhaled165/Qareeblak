"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, CheckCheck, X, Calendar, MessageSquare, AlertCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/components/providers/AppProvider";
import { apiCall } from "@/lib/api";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = API_URL.replace(/\/api$/, '');

interface Notification {
    id: number;
    user_id: number;
    title?: string;
    message: string;
    type: string; // 'appointment_update' | 'status_update' | 'chat_alert' | 'system'
    reference_id: string | null;
    is_read: boolean;
    created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
    appointment_update: <Calendar className="w-4 h-4 text-blue-500" />,
    status_update: <Info className="w-4 h-4 text-indigo-500" />,
    chat_alert: <MessageSquare className="w-4 h-4 text-emerald-500" />,
    system: <AlertCircle className="w-4 h-4 text-amber-500" />,
};

export function NotificationBell() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const socketRef = useRef<any>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const hasQareeblakToken = typeof window !== 'undefined' && !!localStorage.getItem('qareeblak_token');

    const fetchNotifications = useCallback(async () => {
        if (!currentUser?.id || !hasQareeblakToken) return;
        try {
            const data = await apiCall('/notifications');
            if (Array.isArray(data)) {
                // De-duplicate notifications by ID (ensuring string comparison for safety)
                const uniqueData = data.reduce((acc: Notification[], curr: Notification) => {
                    const isDuplicate = acc.some((n: Notification) => String(n.id) === String(curr.id));
                    if (!isDuplicate) acc.push(curr);
                    return acc;
                }, []);
                setNotifications(uniqueData);
                setUnreadCount(uniqueData.filter((n: Notification) => !n.is_read).length);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [currentUser?.id, hasQareeblakToken]);

    // Initial fetch + polling
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Socket.io real-time listener
    useEffect(() => {
        if (!currentUser?.id || !hasQareeblakToken) return;

        const connectSocket = async () => {
            try {
                const { io } = await import('socket.io-client');
                const token = localStorage.getItem('qareeblak_token');

                if (!token) {
                    return;
                }

                const socket = io(API_BASE, {
                    transports: ['polling', 'websocket'],
                    auth: { token }
                });
                socketRef.current = socket;

                socket.on('new-notification', (data: { userId: string; notification: Notification }) => {
                    if (String(data.userId) === String(currentUser.id)) {
                        setNotifications(prev => {
                            // Prevent duplicates using string comparison
                            if (prev.some((n: Notification) => String(n.id) === String(data.notification.id))) return prev;

                            // If we found a unique new notification, update count and list
                            setUnreadCount(c => c + 1);
                            return [data.notification, ...prev];
                        });
                    }
                });

                return () => socket.disconnect();
            } catch (e) {
                console.error('Socket connection failed:', e);
            }
        };

        connectSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [currentUser?.id, hasQareeblakToken]);

    const markAsRead = async (id: number) => {
        try {
            await apiCall(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev =>
                prev.map(n => String(n.id) === String(id) ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error('Failed to mark as read:', e);
        }
    };

    const markAllRead = async () => {
        if (!currentUser?.id) return;
        try {
            await apiCall('/notifications/read-all', { method: 'PATCH' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Failed to mark all read:', e);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            markAsRead(notification.id);
        }

        // Open details modal instead of navigating directly
        setSelectedNotification(notification);
        setIsOpen(false);
    };

    const handleActionClick = (notification: any) => {
        setSelectedNotification(null);
        if (notification.reference_id) {
            if (notification.type === 'chat_alert') {
                router.push(`/chat/${notification.reference_id}`);
            }
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `منذ ${minutes} دقيقة`;
        if (hours < 24) return `منذ ${hours} ساعة`;
        return `منذ ${days} يوم`;
    };

    if (!currentUser || !hasQareeblakToken) return null;

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-foreground hover:bg-accent rounded-full transition-colors group"
                aria-label="الإشعارات"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background group-hover:scale-110 transition-transform"
                    >
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-x-4 top-[72px] sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-2 sm:w-96 bg-card rounded-xl shadow-2xl border border-border overflow-hidden z-50 max-h-[80vh] sm:max-h-[70vh] flex flex-col origin-top"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                                <h4 className="font-bold text-sm">الإشعارات</h4>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                                        >
                                            <CheckCheck className="w-3 h-3" />
                                            تحديد الكل كمقروء
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 hover:bg-accent rounded-full"
                                        aria-label="إغلاق الإشعارات"
                                        title="إغلاق الإشعارات"
                                    >
                                        <X className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>

                            {/* Notifications List */}
                            <div className="overflow-y-auto flex-1">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">لا توجد إشعارات</p>
                                    </div>
                                ) : (
                                    notifications.map((notification, index) => (
                                        <motion.button
                                            key={`${notification.id}-${index}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`w-full text-right px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors flex items-start gap-3 ${!notification.is_read ? 'bg-primary/5' : ''}`}
                                        >
                                            {/* Icon */}
                                            <div className={`mt-0.5 p-1.5 rounded-full ${!notification.is_read ? 'bg-primary/10' : 'bg-muted/50'}`}>
                                                {typeIcons[notification.type] || <Bell className="w-4 h-4 text-muted-foreground" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 text-right">
                                                <p className={`text-sm mb-1 ${!notification.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                                                    {notification.title || 'إشعار جديد'}
                                                </p>
                                                {notification.message && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {formatTime(notification.created_at)}
                                                </p>
                                            </div>

                                            {/* Unread dot */}
                                            {!notification.is_read && (
                                                <div className="mt-2 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                            )}
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Notification Details Modal */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {selectedNotification && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                                onClick={() => setSelectedNotification(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 overflow-hidden text-right"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="p-2 hover:bg-accent rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-muted-foreground" />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold">{selectedNotification.title || 'تفاصيل الإشعار'}</h3>
                                        <div className="p-2.5 rounded-full bg-primary/10">
                                            {typeIcons[selectedNotification.type] || <Bell className="w-5 h-5 text-primary" />}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-accent/50 p-4 rounded-xl mb-6">
                                    <p className="text-foreground leading-relaxed">
                                        {selectedNotification.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-3">
                                        {formatTime(selectedNotification.created_at)}
                                    </p>
                                </div>
                                
                                {selectedNotification.reference_id && selectedNotification.type === 'chat_alert' && (
                                    <button
                                        onClick={() => handleActionClick(selectedNotification)}
                                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                    >
                                        عرض المحادثة
                                    </button>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
