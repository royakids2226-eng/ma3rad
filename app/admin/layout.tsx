import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { authOptions } from "@/auth"; // 👈 1. استيراد ملف الإعدادات

const prisma = new PrismaClient();

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 👇 2. تمرير الإعدادات هنا لكي يتعرف على الجلسة
  const session = await getServerSession(authOptions);

  if (!session?.user?.image) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.image as string },
  });

  // التحقق من الصلاحية (أدمن أو مالك فقط)
  if (!user || (user.role !== "ADMIN" && user.role !== "OWNER")) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans" dir="rtl">
      <nav className="bg-slate-900 text-white p-4 shadow-md mb-6">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-xl font-bold">لوحة التحكم 🛡️</div>
          <div className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-yellow-400">الرئيسية</Link>
            <Link href="/" className="hover:text-yellow-400">تطبيق البيع</Link>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto p-4">
        {children}
      </main>
    </div>
  );
}