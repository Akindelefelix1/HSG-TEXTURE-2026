import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "HSG Texture — Exceptional Fabrics",
  description: "Shop remarkable fabrics, from heritage Aso-Oke and lace to linen, velvet and statement prints.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><Suspense fallback={null}>{children}</Suspense></body>
    </html>
  );
}
