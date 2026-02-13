"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, Loader2, X, Store } from "lucide-react";
import { apiCall } from "@/lib/api";

interface Provider {
    id: string;
    name: string;
    category?: string;
}

interface ProviderSearchDropdownProps {
    value: string;
    providerName: string;
    onChange: (providerId: string, providerName: string) => void;
}

export function ProviderSearchDropdown({
    value,
    providerName,
    onChange
}: ProviderSearchDropdownProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Provider[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const searchProviders = useCallback(async (q: string) => {
        if (q.trim().length < 1) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const data = await apiCall(`/providers/search?q=${encodeURIComponent(q)}`);
            setResults(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Provider search error:', error);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchProviders(val), 300);
    };

    const handleSelect = (provider: Provider) => {
        onChange(provider.id, provider.name);
        setQuery('');
        setResults([]);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('', '');
        setQuery('');
        setResults([]);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (value && providerName) {
        return (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate flex-1">{providerName}</span>
                <button type="button" onClick={handleClear} className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-full" title="مسح المورد">
                    <X className="w-3.5 h-3.5 text-emerald-500" />
                </button>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                    placeholder="ابحث عن مقدم خدمة..."
                    title="بحث عن مقدم خدمة"
                    aria-label="ابحث عن مقدم خدمة"
                />
                {isSearching && (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500 animate-spin" />
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[100] max-h-48 overflow-auto">
                    {results.map((provider) => (
                        <div
                            key={provider.id}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(provider);
                            }}
                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                        >
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{provider.name}</div>
                            {provider.category && (
                                <div className="text-xs text-slate-400 mt-0.5">{provider.category}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isOpen && query.trim().length > 0 && results.length === 0 && !isSearching && (
                <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[100] px-4 py-3 text-sm text-slate-500">
                    لا توجد نتائج
                </div>
            )}
        </div>
    );
}
