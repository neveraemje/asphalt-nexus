import type { Metadata } from "next";
import { AppHeader } from "@/components/nexus/app-header";
import { NexusDataProvider } from "@/components/nexus/nexus-data-provider";
import "./globals.css";
import { rupaSansApp } from "./fonts";

export const metadata: Metadata = {
  title: "Asphalt Nexus",
  description: "Browse and manage Gojek application screen libraries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${rupaSansApp.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--nexus-page)] text-[#202020]">
        <NexusDataProvider>
          <AppHeader />
          {children}
        </NexusDataProvider>
      </body>
    </html>
  );
}
