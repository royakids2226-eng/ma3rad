import { getAdminStockAlerts } from "@/app/actions";
import Link from "next/link";

// لضمان تحديث البيانات عند كل زيارة للصفحة
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // جلب التنبيهات من السيرفر
  const stockAlerts = await getAdminStockAlerts();

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* 🔴 قسم التنبيهات الجديد (تمت إضافته) */}
      {stockAlerts.count > 0 && (
        <div className="bg-red-50 border-r-4 border-red-600 p-6 rounded-lg shadow-sm animate-pulse-slow mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-xl font-bold text-red-800">تنبيهات نواقص المخزون (أصناف مغلقة)</h2>
              <p className="text-red-600 text-sm">يوجد {stockAlerts.count} صنف وصل للحد الأدنى (4 قطع أو أقل)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
            {stockAlerts.items.map((item: any) => (
              <div key={item.id} className="bg-white p-3 rounded border border-red-200 shadow-sm flex justify-between items-center">
                <div>
                  <div className="font-bold text-gray-800">{item.modelNo}</div>
                  <div className="text-xs text-gray-500">{item.color}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{item.currentStock}</div>
                  <div className="text-[10px] text-gray-400">قطعة متبقية</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-left">
            <Link href="/admin/products" className="text-red-700 text-sm font-bold hover:underline">إدارة المنتجات لتعديل الحالة ⬅</Link>
          </div>
        </div>
      )}
      {/* 🔴 نهاية قسم التنبيهات */}

      {/* شبكة البطاقات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 1. إدارة الموظفين */}
        <Link
          href="/admin/users"
          className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-b-4 border-blue-600 group cursor-pointer"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
              👥 إدارة الموظفين
            </h2>
          </div>
          <p className="text-gray-600">
            إضافة مستخدمين جدد، وتحديد الصلاحيات (محاسب، بائع..).
          </p>
        </Link>

        {/* 2. إدارة العملاء */}
        <Link
          href="/admin/customers"
          className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-b-4 border-yellow-500 group cursor-pointer"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-yellow-600 transition-colors">
              🤝 إدارة العملاء
            </h2>
          </div>
          <p className="text-gray-600">
            إضافة عملاء جدد وتعديل بياناتهم وسجلاتهم.
          </p>
        </Link>

        {/* 3. إدارة الأصناف */}
        <Link
          href="/admin/products"
          className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-b-4 border-green-600 group cursor-pointer"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-green-700 transition-colors">
              👚 إدارة الأصناف
            </h2>
          </div>
          <p className="text-gray-600">
            إضافة موديلات جديدة، ألوان، وتعديل الأسعار والمخزون.
          </p>
        </Link>

        {/* 4. التقارير (تم التفعيل الآن ✅) */}
        {/* جعلناه يأخذ العرض الكامل في الشاشات الكبيرة ليظهر بشكل مميز */}
        <Link
          href="/admin/reports"
          className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-b-4 border-purple-600 group cursor-pointer md:col-span-3 lg:col-span-3"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-purple-700 transition-colors">
              📊 التقارير والإحصائيات
            </h2>
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-bold">جديد</span>
          </div>
          <p className="text-gray-600">
            جرد المخزون، دفتر أستاذ الخزنة، متابعة المبيعات والمديونيات، وطباعة التقارير المالية.
          </p>
        </Link>

      </div>
    </div>
  );
}