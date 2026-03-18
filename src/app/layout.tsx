import type { Metadata } from "next";
import { Cairo } from "next/font/google"; // Using Cairo as requested for Arabic
import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AppProvider } from "@/components/providers/AppProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ConfirmProvider } from "@/components/providers/ConfirmProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CartProvider } from "@/components/providers/CartProvider";

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
      { url: "/qareeblak-logo.png?v=20260318", type: "image/png", sizes: "32x32" },
      { url: "/qareeblak-logo.png?v=20260318", type: "image/png", sizes: "192x192" },
      { url: "/qareeblak-icon.ico?v=20260318", type: "image/x-icon", sizes: "any" }
    ],
    shortcut: [{ url: "/qareeblak-logo.png?v=20260318", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/qareeblak-logo.png?v=20260318", sizes: "180x180", type: "image/png" }],
  },
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
  themeColor: "#6366F1",
};

import ErrorBoundary from "@/components/shared/ErrorBoundary";

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
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <AppProvider>
                <ConfirmProvider>
                  <Navbar />
                  <main className="flex-1">
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </main>
                  <Footer />
                </ConfirmProvider>
              </AppProvider>
            </ThemeProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
