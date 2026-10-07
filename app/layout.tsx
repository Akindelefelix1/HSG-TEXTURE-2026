import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "HSG Texture — Exceptional Fabrics",
  description: "Shop remarkable fabrics, from heritage Aso-Oke and lace to linen, velvet and statement prints.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/hsg-texture-logo.jpg?v=2", type: "image/jpeg", sizes: "1080x1080" }],
    shortcut: "/hsg-texture-logo.jpg?v=2",
    apple: [{ url: "/hsg-texture-logo.jpg?v=2", type: "image/jpeg", sizes: "1080x1080" }],
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
