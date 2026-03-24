"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function SkeletonCard() {
    return (
        <div className="h-full relative flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-pulse">
            {/* Header Skeleton */}
            <div className="relative h-32 w-full bg-slate-100 dark:bg-slate-800" />

            {/* Avatar Skeleton */}
            <div className="absolute top-16 right-6">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-md border border-slate-100 dark:border-slate-700">
                    <div className="w-full h-full rounded-xl bg-slate-200 dark:bg-slate-700" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="pt-8 px-6 pb-6 flex-1 flex flex-col relative z-10">
                <div className="flex justify-between items-start mb-1">
                    <div className="space-y-2 w-1/2">
                        <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-md" />
                        <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800 rounded-md" />
                    </div>
                    <div className="w-12 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                </div>

                <div className="h-8 w-1/2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 my-4" />

                <div className="mt-auto pt-2">
                    <div className="w-full h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                </div>
            </div>
        </div>
    );
}
