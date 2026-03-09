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
  title: "خدمات أسيوط الجديدة",
  description: "دليلك الشامل لجميع الخدمات في مدينة أسيوط الجديدة",
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
        <script src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs" type="module" async></script>
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
