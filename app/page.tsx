import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded shadow">
        <div>
          <h1 className="text-lg font-bold">أهلاً، {session.user?.name}</h1>
          <p className="text-xs text-gray-500">كود: {session.user?.email}</p>
        </div>
        <Link href="/api/auth/signout" className="text-red-500 text-sm font-bold">خروج</Link>
      </header>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4">
        <Link href="/orders/new" className="bg-blue-600 text-white p-6 rounded-xl shadow-lg flex items-center justify-between">
          <span className="text-2xl font-bold">أوردر جديد 🛒</span>
          <span className="text-4xl">+</span>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white p-4 rounded-xl shadow text-gray-700 font-bold border border-gray-200">
             📝 الأوردرات السابقة
          </button>
          <button className="bg-white p-4 rounded-xl shadow text-gray-700 font-bold border border-gray-200">
             💰 تحصيل دفعة
          </button>
        </div>
      </div>
      
      {/* Footer info */}
      <div className="mt-10 text-center text-gray-400 text-xs">
        نظام إدارة المبيعات v1.0
      </div>
    </div>
  );
}