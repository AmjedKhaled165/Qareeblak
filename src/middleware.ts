import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Secure all /admin routes
    if (pathname.startsWith('/admin')) {
        // Enforce strict Security Headers on all Admin routes
        const response = NextResponse.next();
        response.headers.set('X-Frame-Options', 'DENY'); // Protect against Clickjacking
        response.headers.set('X-Content-Type-Options', 'nosniff'); // Protect against MIME sniffing
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
