import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeLens | جرّب قرارك وتابع نتيجته",
  description: "محفظة افتراضية بأسعار إغلاق سوق دبي الرسمية ومتابعة الرسوم والربح والخسارة.",
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
    <html lang="ar">
      <body className="antialiased">{children}</body>
    </html>
  );
}
