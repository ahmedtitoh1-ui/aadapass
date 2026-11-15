import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import FirebaseProvider from "@/components/FirebaseProvider";
import "./globals.css";

const arabicSans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Aada Pass - منصة الولاء ودليل المتاجر",
  description:
    "منصة عادة باس لإدارة برامج الولاء المشتركة ودليل المتاجر وبوابة مدير النظام ووكيل الدعم والكاشير.",
  icons: {
    icon: "/pwa-192x192.png",
    shortcut: "/pwa-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Aada Pass - منصة الولاء ودليل المتاجر",
    description:
      "منصة عادة باس لإدارة برامج الولاء المشتركة ودليل المتاجر وبوابة مدير النظام ووكيل الدعم والكاشير.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabicSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-100 selection:text-sky-900">
        <FirebaseProvider>{children}</FirebaseProvider>
      </body>
    </html>
  );
}
