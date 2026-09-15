import { apiCall } from './api';

/**
 * Utility to convert the Base64 VAPID public key into a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Subscribe the current device to push notifications
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported by this browser');
            return false;
        }

        const registration = await navigator.serviceWorker.ready;

        // Fetch VAPID public key from backend
        let vapidPublicKey;
        try {
            const keyData = await apiCall('/push/vapid-key');
            vapidPublicKey = keyData.publicKey;
        } catch (e) {
            console.error('Failed to get VAPID key:', e);
            return false;
        }

        if (!vapidPublicKey) return false;

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        // Send subscription to backend
        await apiCall('/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({
                subscription,
                userAgent: navigator.userAgent
            })
        });

        return true;
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        return false;
    }
}

/**
 * Unsubscribe the current device from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            
            // Notify backend to remove the subscription
            await apiCall('/push/unsubscribe', {
                method: 'DELETE',
                body: JSON.stringify({
                    endpoint: subscription.endpoint
                })
            });
            
            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
        return false;
    }
}

/**
 * Check if the device is currently subscribed
 */
export async function isPushSubscribed(): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch (error) {
        return false;
    }
}
