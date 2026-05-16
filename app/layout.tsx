import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { ThemeProvider } from "next-themes";

import "./globals.css";

import { AppShell } from "./components/app-shell";
import { AppProgressBar } from "./components/app-progress";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";

export const metadata: Metadata = {
  title: "AI Business",
  description: "Orchestration cockpit for AI-driven businesses",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body
        className={`${GeistSans.className} min-h-svh antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            <NeonAuthUIProvider authClient={authClient}>
              <AppProgressBar />
              <AppShell>{children}</AppShell>
              <Toaster />
            </NeonAuthUIProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
