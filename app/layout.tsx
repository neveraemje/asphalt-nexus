import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--nexus-page)] text-[#202020]">
        {children}
      </body>
    </html>
  );
}
