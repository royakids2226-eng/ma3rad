import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { authOptions } from "@/auth";

const prisma = new PrismaClient();

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <nav className="bg-slate-900 text-white p-4 shadow-md mb-6 sticky top-0 z-50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="text-xl font-bold flex items-center gap-2">
            <span>🛡️ لوحة التحكم</span>
            <span className="text-xs font-normal bg-slate-700 px-2 py-1 rounded text-gray-300">
              {user.name}
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm font-bold items-center">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">
              🏠 الرئيسية
            </Link>
            
            <Link href="/admin/users" className="hover:text-yellow-400 transition-colors">
              👥 الموظفين
            </Link>
            
            <Link href="/admin/customers" className="hover:text-yellow-400 transition-colors">
              🤝 العملاء
            </Link>
            
            <Link href="/admin/products" className="hover:text-yellow-400 transition-colors">
              📦 الأصناف
            </Link>
            
            {/* 👇 رابط التقارير الجديد */}
            <Link href="/admin/reports" className="text-yellow-300 hover:text-yellow-100 border-b-2 border-yellow-500 pb-1 transition-colors">
              📊 التقارير
            </Link>

            <div className="hidden md:block w-px h-6 bg-gray-600 mx-2"></div>

            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors flex items-center gap-1">
              🛒 تطبيق البيع
            </Link>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto p-4 pb-20">
        {children}
      </main>
    </div>
  );
}