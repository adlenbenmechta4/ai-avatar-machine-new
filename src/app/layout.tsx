import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kobisto - AI Video Platform",
  description: "Create stunning AI-powered videos, avatars, and content with Kobisto. Advanced video generation, avatar creation, and more.",
  keywords: ["Kobisto", "AI video", "video generation", "AI avatar", "content creation", "AI tools"],
  authors: [{ name: "Kobisto" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Kobisto - AI Video Platform",
    description: "Create stunning AI-powered videos, avatars, and content with Kobisto.",
    url: "https://kobisto.com",
    siteName: "Kobisto",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kobisto - AI Video Platform",
    description: "Create stunning AI-powered videos, avatars, and content with Kobisto.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
