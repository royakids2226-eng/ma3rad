// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "./providers"; // تأكد أن المسار صحيح
import ExitConfirmation from "@/components/ExitConfirmation"; // استيراد المكون الجديد

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "تطبيق الأوردرات",
  description: "نظام إدارة المبيعات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning={true}>
      <body className={`${inter.className} min-h-screen bg-slate-900 m-0 p-0`}>
        <NextAuthProvider>
          <ExitConfirmation /> {/* إضافة المكون هنا */}
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}