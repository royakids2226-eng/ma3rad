import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "./actions"; 
import { authOptions } from "@/auth";
import NotificationBell from "./admin/NotificationBell";
import TestOrderButton from "./TestOrderButton";

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.image) {
    redirect("/login");
  }

  const user = await getCurrentUser(session.user.image as string);
  
  if (!user) {
     redirect("/api/auth/signout");
  }

  const isAllowedInAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'ACCOUNTANT';
  const isTestUser = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-800">أهلاً، {session.user?.name} 👋</h1>
          <p className="text-xs font-bold text-gray-400 mt-1">
            {user?.role === 'ADMIN' && 'مدير النظام 🛡️'}
            {user?.role === 'OWNER' && 'صاحب الشركة 👑'}
            {user?.role === 'ACCOUNTANT' && 'محاسب 💰'}
            {user?.role === 'EMPLOYEE' && 'موظف مبيعات 👤'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            {isAllowedInAdmin && <NotificationBell isDark={false} />}

            {isTestUser && <TestOrderButton userId={user.id} />}

            {isAllowedInAdmin && (
                <Link href="/admin" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
                    <span>لوحة التحكم</span>
                    <span>🛡️</span>
                </Link>
            )}
            <Link href="/api/auth/signout" className="text-red-500 text-sm font-bold border-2 border-red-50 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors flex items-center">
                خروج
            </Link>
        </div>
      </header>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
        <Link href="/orders/new" className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-200 flex items-center justify-between hover:bg-blue-700 transition-all transform hover:scale-[1.02] active:scale-95 group">
          <div className="flex flex-col items-start">
            <span className="text-3xl font-black mb-1">أوردر جديد</span>
            <span className="text-blue-200 text-sm font-bold group-hover:text-white transition-colors">إضافة طلب بيع وكاشير</span>
          </div>
          <span className="text-5xl bg-white/20 w-16 h-16 flex items-center justify-center rounded-2xl">+</span>
        </Link>

        <div className={`grid ${user?.role === 'EMPLOYEE' ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
          <Link href="/orders/list" className="bg-white p-6 rounded-3xl shadow-sm text-gray-700 font-bold border border-gray-100 text-center hover:bg-gray-50 flex flex-col justify-center items-center gap-3 transition-all hover:-translate-y-1">
             <span className="text-4xl bg-gray-50 p-3 rounded-2xl">📝</span>
             <span>الأوردرات السابقة</span>
          </Link>

          {user?.role !== 'EMPLOYEE' && (
            <Link href="/payments/new" className="bg-white p-6 rounded-3xl shadow-sm text-gray-700 font-bold border border-gray-100 text-center hover:bg-gray-50 flex flex-col justify-center items-center gap-3 transition-all hover:-translate-y-1">
                <span className="text-4xl bg-gray-50 p-3 rounded-2xl">💰</span>
                <span>إدارة النقدية</span>
            </Link>
          )}

          <Link href="/sorting" className={`${user?.role === 'EMPLOYEE' ? 'col-span-1' : 'col-span-2'} bg-white p-6 rounded-3xl shadow-sm text-emerald-700 font-bold border border-emerald-100 text-center hover:bg-emerald-50 flex flex-row justify-center items-center gap-4 transition-all hover:shadow-emerald-100 hover:shadow-lg`}>
             <span className="text-4xl">📦</span>
             <span className="text-xl">فرز المخزن (جاهزية الأوردرات)</span>
          </Link>
        </div>
      </div>
      
      <div className="mt-12 text-center text-gray-300 text-xs font-mono">
        نظام إدارة المبيعات v1.8 • Royakids
      </div>
    </div>
  );
}
