import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { SideNav } from "@/components/SideNav";
import { TzCookieSetter } from "@/components/TzCookieSetter";
import { AppHeader } from "@/components/AppHeader";
import { FeedingSheetProvider } from "@/components/feeding-sheet/FeedingSheetProvider";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { getTzFromCookie } from "@/lib/api/tz";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leon",
  description: "Feeding tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const active = await resolveActiveBaby();
  const tz = await getTzFromCookie();

  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <TzCookieSetter />
          <FeedingSheetProvider babyId={active?.baby._id ?? null} tz={tz}>
            <SidebarProvider>
              <SideNav />
              <SidebarInset>
                <AppHeader hasActiveBaby={!!active} />
                <div className="block w-full">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </FeedingSheetProvider>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
