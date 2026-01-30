import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-6" dir="rtl">
      
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