import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/providers/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const etnaSans = localFont({
  src: [
    {
      path: "../fonts/Etna-Regular.otf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-etna",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Avatar Machine",
  description: "Create AI avatar talking videos with consistent characters across multiple scenes",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    appleTouchIcon: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${etnaSans.variable} antialiased`}
        style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E" }}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
