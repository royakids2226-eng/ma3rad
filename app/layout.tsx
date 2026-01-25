// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "./providers"; // تأكد أن المسار صحيح

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
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}