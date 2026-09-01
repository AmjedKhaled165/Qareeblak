import type { Metadata } from "next";
import { Cairo } from "next/font/google"; // Using Cairo as requested for Arabic
import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AppProvider } from "@/components/providers/AppProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { SmoothScroll } from "@/components/animations/SmoothScroll";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://qareeblak.com"),
  title: {
    default: "قريبلك | خدمات أسيوط الجديدة",
    template: "%s | قريبلك"
  },
  description: "منصتك الأولى لجميع خدمات أسيوط الجديدة — مطاعم، صيانة، صيدليات، وأكثر. اطلب في ثواني.",
  keywords: ["أسيوط الجديدة", "خدمات", "مطاعم", "صيانة", "صيدليات", "قريبلك"],
  authors: [{ name: "قريبلك" }],
  icons: {
    icon: [
      { url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "16x16" },
      { url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "32x32" },
      { url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "180x180" },
      { url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "192x192" },
      { url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/Qareeblak_Logo_rbg.png?v=20260327", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/Qareeblak_Logo_rbg.png?v=20260327", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  robots: "index, follow",
  openGraph: {
    title: "قريبلك | خدمات أسيوط الجديدة",
    description: "منصتك الأولى لجميع خدمات أسيوط الجديدة",
    locale: "ar_EG",
    type: "website",
    url: "https://qareeblak.com",
    images: [{
      url: "/qareeblak-logo-white-bg.jpg",
      width: 128,
      height: 128,
      alt: "قريبلك"
    }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
  themeColor: "#6366F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {/* Preconnect to Google Fonts to eliminate render-blocking requests */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${cairo.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <ToastProvider>
          <CartProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <AppProvider>
                <ConfirmProvider>
                  <SmoothScroll>
                    <Navbar />
                    <main className="flex-1 pb-32 md:pb-10">
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                    </main>
                    <MobileBottomNav />
                    <Footer />
                  </SmoothScroll>
                </ConfirmProvider>
              </AppProvider>
            </ThemeProvider>
          </CartProvider>
        </ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
