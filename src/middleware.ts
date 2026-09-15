import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const response = NextResponse.next();

    // ── Force UTF-8 charset on all page responses ──────────────────────
    // Fixes Arabic text rendering as garbled characters (mojibake) on
    // deployed servers where the reverse proxy / CDN may strip or omit
    // the charset from Content-Type headers.
    // The matcher below already excludes static assets, _next, and API routes.
    if (!pathname.startsWith('/api/')) {
        response.headers.set('Content-Type', 'text/html; charset=utf-8');
    }

    // Secure all /admin routes
    if (pathname.startsWith('/admin')) {
        // Enforce strict Security Headers on all Admin routes
        response.headers.set('X-Frame-Options', 'DENY'); // Protect against Clickjacking
        response.headers.set('X-Content-Type-Options', 'nosniff'); // Protect against MIME sniffing
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }

    return response;
}

export const config = {
    matcher: [
        // Match all page routes (not static files, images, fonts, or API routes)
        '/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|eot|mp3|mp4|json|js|css|map)$).*)',
    ],
};
