import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { authOptions } from "@/auth";
import NotificationBell from "./NotificationBell";
import { HomeIcon, UsersIcon, UserGroupIcon, ArchiveBoxIcon, ChartBarIcon, ShoppingCartIcon, BanknotesIcon } from '@heroicons/react/24/outline';

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

  if (!user) {
    redirect("/");
  }

  const allowedRoles = ["ADMIN", "OWNER", "ACCOUNTANT"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans" dir="rtl">
      <nav className="bg-slate-900 text-white p-4 shadow-xl mb-8 sticky top-0 z-50 backdrop-blur-md bg-slate-900/95 border-b border-slate-800">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="text-xl font-bold flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
                <span className="block leading-none">لوحة التحكم</span>
                <span className="text-[10px] font-normal text-slate-400">
                  مرحباً بك، {user.name} | صلاحيتك: {user.role}
                </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-sm font-bold items-center bg-slate-800/50 p-1.5 rounded-2xl">
            <Link href="/admin" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
              <HomeIcon className="w-5 h-5" /> <span className="hidden lg:inline">الرئيسية</span>
            </Link>
            
            {user.role !== 'ACCOUNTANT' && (
              <Link href="/admin/users" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
                <UsersIcon className="w-5 h-5" /> <span className="hidden lg:inline">الموظفين</span>
              </Link>
            )}
            
            <Link href="/admin/customers" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" /> <span className="hidden lg:inline">العملاء</span>
            </Link>
            
            <Link href="/admin/products" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
              <ArchiveBoxIcon className="w-5 h-5" /> <span className="hidden lg:inline">الأصناف</span>
            </Link>
            
            <Link href="/admin/reports" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5" /> <span className="hidden lg:inline">التقارير</span>
            </Link>

            {user.role !== 'EMPLOYEE' && (
              <Link href="/admin/safes" className="px-3 py-2 rounded-xl hover:bg-slate-700 hover:text-yellow-400 transition-colors flex items-center gap-2">
                <BanknotesIcon className="w-5 h-5" /> <span className="hidden lg:inline">إدارة النقدية</span>
              </Link>
            )}

            <div className="w-px h-6 bg-slate-700 mx-1"></div>

            <NotificationBell isDark={true} />

            <Link href="/" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95">
              <ShoppingCartIcon className="w-5 h-5" />
              <span>تطبيق البيع</span>
            </Link>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto p-4 pb-20 animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  );
}
