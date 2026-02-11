import Link from "next/link";
import { getUsers, getProducts, getAdminCustomers } from "@/app/admin-actions";

export default async function AdminDashboard() {
  // جلب البيانات للإحصائيات العامة فقط
  const users = await getUsers();
  const products = await getProducts();
  const customers = await getAdminCustomers();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ترويسة الصفحة */}
      <div className="flex justify-between items-end border-b border-gray-100 pb-6">
        <div>
           <h1 className="text-3xl font-black text-gray-800">لوحة القيادة</h1>
           <p className="text-gray-400 font-bold mt-1">نظرة عامة على النظام والإحصائيات</p>
        </div>
      </div>

      {/* شبكة بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* كارت الموظفين */}
        <Link href="/admin/users" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 font-bold text-sm mb-2 uppercase tracking-wider">الموظفين</p>
                    <h3 className="text-4xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{users.length}</h3>
                </div>
                <span className="text-4xl bg-slate-50 p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-slate-100">👥</span>
            </div>
        </Link>

        {/* كارت العملاء */}
        <Link href="/admin/customers" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 font-bold text-sm mb-2 uppercase tracking-wider">العملاء المسجلين</p>
                    <h3 className="text-4xl font-black text-slate-800 group-hover:text-yellow-500 transition-colors">{customers.length}</h3>
                </div>
                <span className="text-4xl bg-yellow-50 p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-yellow-100">🤝</span>
            </div>
        </Link>

        {/* كارت المنتجات */}
        <Link href="/admin/products" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 font-bold text-sm mb-2 uppercase tracking-wider">إجمالي الأصناف</p>
                    <h3 className="text-4xl font-black text-slate-800 group-hover:text-purple-600 transition-colors">{products.length}</h3>
                </div>
                <span className="text-4xl bg-purple-50 p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-purple-100">📦</span>
            </div>
        </Link>

      </div>

      {/* منطقة ترحيبية بسيطة أسفل البطاقات لملء الفراغ بشكل جمالي */}
      <div className="bg-gradient-to-br from-slate-50 to-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center opacity-60 select-none">
        <span className="text-6xl block mb-4 grayscale opacity-50">🛡️</span>
        <p className="text-slate-400 font-bold text-xl">نظام إدارة المبيعات المركزي</p>
        <p className="text-slate-300 text-sm mt-2">Royakids Dashboard v1.8</p>
      </div>
    </div>
  );
}