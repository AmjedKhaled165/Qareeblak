"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * Enterprise Error Boundary
 * Prevents "White Screen of Death" (WSOD).
 * Pattern used by all high-scale React apps (Uber, Amazon, etc.)
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("💥 UI Crash caught by ErrorBoundary:", error, errorInfo);
        // Here you would typically log to Sentry
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 m-4">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">عذراً، حدث خطأ ما</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                        واجهنا مشكلة تقنية أثناء تحميل هذا الجزء. لا تقلق، بياناتك في أمان.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-lg active:scale-95"
                    >
                        <RotateCcw className="w-5 h-5" />
                        محاولة مرة أخرى
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-left text-xs overflow-auto max-w-full text-red-500">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
