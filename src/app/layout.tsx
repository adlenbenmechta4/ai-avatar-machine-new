import type { Metadata } from "next";
import { Etna, SugoProDisplay } from "@/src/fonts";
import { AuthProvider } from "@/src/providers/auth-provider";
import { SessionProvider } from "@/src/providers/session-provider";
import { Toaster } from "@/src/components/ui/sonner";

export const metadata: Metadata = {
  title: "AI Avatar Machine",
  description:
    "Create AI avatar talking videos with consistent characters across multiple scenes",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
        className="antialiased"
        style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E" }}
      >
        <SessionProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
