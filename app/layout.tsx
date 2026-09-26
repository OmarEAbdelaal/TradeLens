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
    <html lang="ar" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{var t=localStorage.getItem('tradelens-theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var l=localStorage.getItem('tradelens-language');if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr'}}catch(e){}"}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
