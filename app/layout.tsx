import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeLens | Research before you trade",
  description: "Your private stock research, risk planning and paper trading workspace.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
