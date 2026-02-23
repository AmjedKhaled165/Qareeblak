"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function SkeletonCard() {
    return (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col bg-white dark:bg-slate-900 animate-pulse">
            <div className="h-40 w-full bg-slate-200 dark:bg-slate-800" />
            <CardContent className="p-4 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2 w-2/3">
                        <div className="h-5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                </div>
                <div className="h-4 w-1/2 mb-4 bg-slate-200 dark:bg-slate-800 rounded" />
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </CardFooter>
        </Card>
    );
}
