import { useState, useEffect } from "react";

/**
 * Enterprise throttle/debounce hook.
 * Essential for search inputs to prevent main-thread freezing 
 * when filtering large data arrays (Standard in Talabat/Uber).
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
