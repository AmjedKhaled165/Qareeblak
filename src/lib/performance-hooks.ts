/**
 * ⚡ PERFORMANCE OPTIMIZATION UTILITIES
 * 
 * Collection of React hooks and utilities for optimizing frontend performance:
 * - Debounced search inputs (reduce API calls by 90%)
 * - Intersection Observer for lazy loading
 * - Virtual scrolling hooks
 * - Image lazy loading
 * - Local storage with expiry
 */

import { useEffect, useState, useRef, useCallback } from 'react';

// ============================================
// 1. DEBOUNCED INPUT HOOK (Reduce API Calls)
// ============================================
/**
 * Usage:
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   if (debouncedSearch) fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// ============================================
// 2. INTERSECTION OBSERVER (Lazy Load Images/Components)
// ============================================
/**
 * Usage:
 * const [ref, isVisible] = useIntersectionObserver();
 * 
 * <div ref={ref}>
 *   {isVisible && <HeavyComponent />}
 * </div>
 */
export function useIntersectionObserver(
    options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
    const [isVisible, setIsVisible] = useState(false);
    const [node, setNode] = useState<Element | null>(null);

    useEffect(() => {
        if (!node) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, options);

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [node, options]);

    return [setNode, isVisible];
}

// ============================================
// 3. LOCAL STORAGE WITH EXPIRY (Cache API Responses)
// ============================================
interface CacheItem<T> {
    value: T;
    expiry: number;
}

export const cacheStorage = {
    set: <T,>(key: string, value: T, ttlSeconds: number) => {
        const item: CacheItem<T> = {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        };
        try {
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
            console.warn('Failed to cache:', e);
        }
    },

    get: <T,>(key: string): T | null => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            const item: CacheItem<T> = JSON.parse(itemStr);
            
            // Check expiry
            if (Date.now() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            return item.value;
        } catch (e) {
            console.warn('Failed to retrieve cache:', e);
            return null;
        }
    },

    clear: (key: string) => {
        localStorage.removeItem(key);
    }
};

// ============================================
// 4. PREFETCH HOOK (Preload Routes on Hover)
// ============================================
/**
 * Usage:
 * const prefetch = usePrefetch();
 * 
 * <Link href="/dashboard" onMouseEnter={() => prefetch('/dashboard')}>
 */
export function usePrefetch() {
    const { prefetch } = useRouter();
    
    return useCallback((href: string) => {
        prefetch(href);
    }, [prefetch]);
}

// ============================================
// 5. VIRTUAL SCROLL HOOK (For Large Lists)
// ============================================
/**
 * Usage:
 * const [visibleRange, containerRef] = useVirtualScroll({
 *   itemCount: items.length,
 *   itemHeight: 60,
 *   overscan: 5
 * });
 * 
 * <div ref={containerRef} style={{ height: '500px', overflow: 'auto' }}>
 *   {items.slice(visibleRange.start, visibleRange.end).map(item => (...))}
 * </div>
 */
export function useVirtualScroll({
    itemCount,
    itemHeight,
    overscan = 3
}: {
    itemCount: number;
    itemHeight: number;
    overscan?: number;
}) {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;

            const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
            const visibleCount = Math.ceil(containerHeight / itemHeight);
            const end = Math.min(itemCount, start + visibleCount + overscan * 2);

            setVisibleRange({ start, end });
        };

        handleScroll(); // Initial calculation
        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => container.removeEventListener('scroll', handleScroll);
    }, [itemCount, itemHeight, overscan]);

    return [visibleRange, containerRef] as const;
}

// ============================================
// 6. IDLE CALLBACK HOOK (Defer Non-Critical Work)
// ============================================
/**
 * Runs callback only when browser is idle
 * Usage: useIdleCallback(() => sendAnalytics());
 */
export function useIdleCallback(callback: () => void, deps: any[] = []) {
    useEffect(() => {
        if ('requestIdleCallback' in window) {
            const id = requestIdleCallback(callback);
            return () => cancelIdleCallback(id);
        } else {
            // Fallback for Safari
            const id = setTimeout(callback, 1);
            return () => clearTimeout(id);
        }
    }, deps);
}

// ============================================
// 7. NETWORK STATUS HOOK (Handle Offline State)
// ============================================
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

// ============================================
// 8. RAF THROTTLE (Smooth Animations)
// ============================================
export function useRafThrottle(callback: Function) {
    const rafId = useRef<number | null>(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback((...args: any[]) => {
        if (rafId.current !== null) return;

        rafId.current = requestAnimationFrame(() => {
            callbackRef.current(...args);
            rafId.current = null;
        });
    }, []);
}

// Import for usePrefetch
import { useRouter } from 'next/navigation';
