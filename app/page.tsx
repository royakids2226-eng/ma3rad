import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "./actions"; 
import { authOptions } from "@/auth"; // 👈 1. استيراد الإعدادات

export default async function Home() {
  // 👇 2. تمرير الإعدادات هنا هو السر لحل المشكلة
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.image) {
    redirect("/login");
  }

  const user = await getCurrentUser(session.user.image as string);
  
  // حماية إضافية لو اليوزر اتحذف من الداتا بيس
  if (!user) {
     redirect("/api/auth/signout");
  }

  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded shadow">
        <div>
          <h1 className="text-lg font-bold">أهلاً، {session.user?.name}</h1>
          <p className="text-xs text-gray-500">
            {user?.role === 'ADMIN' && 'مدير النظام'}
            {user?.role === 'OWNER' && 'صاحب الشركة'}
            {user?.role === 'ACCOUNTANT' && 'محاسب'}
            {user?.role === 'EMPLOYEE' && 'موظف مبيعات'}
          </p>
        </div>
        
        <div className="flex gap-2">
            {isAdminOrOwner && (
                <Link href="/admin" className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-700 flex items-center">
                    لوحة التحكم 🛡️
                </Link>
            )}
            <Link href="/api/auth/signout" className="text-red-500 text-sm font-bold border border-red-100 px-3 py-2 rounded hover:bg-red-50 flex items-center">
                خروج
            </Link>
        </div>
      </header>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4">
        <Link href="/orders/new" className="bg-blue-600 text-white p-6 rounded-xl shadow-lg flex items-center justify-between hover:bg-blue-700 transition transform hover:scale-[1.01]">
          <span className="text-2xl font-bold">أوردر جديد 🛒</span>
          <span className="text-4xl">+</span>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/orders/list" className="bg-white p-4 rounded-xl shadow text-gray-700 font-bold border border-gray-200 text-center hover:bg-gray-50 flex flex-col justify-center items-center gap-2">
             <span className="text-2xl">📝</span>
             <span>الأوردرات السابقة</span>
          </Link>
          <Link href="/payments/new" className="bg-white p-4 rounded-xl shadow text-gray-700 font-bold border border-gray-200 text-center hover:bg-gray-50 flex flex-col justify-center items-center gap-2">
             <span className="text-2xl">💰</span>
             <span>تحصيل دفعة</span>
          </Link>
        </div>
      </div>
      
      <div className="mt-10 text-center text-gray-400 text-xs">
        نظام إدارة المبيعات v1.5
      </div>
    </div>
  );
}