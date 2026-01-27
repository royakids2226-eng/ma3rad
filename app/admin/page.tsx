import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {/* كارت الموظفين */}
      <Link href="/admin/users" className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition border-b-4 border-blue-600 group">
        <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-600">👥 إدارة الموظفين</h2>
        <p className="text-gray-500">إضافة مستخدمين جدد، وتحديد الصلاحيات (محاسب، بائع..).</p>
      </Link>

      {/* كارت المنتجات */}
      <Link href="/admin/products" className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition border-b-4 border-green-600 group">
        <h2 className="text-2xl font-bold mb-2 group-hover:text-green-600">👕 إدارة الأصناف</h2>
        <p className="text-gray-500">إضافة موديلات جديدة، ألوان، وتعديل الأسعار والمخزون.</p>
      </Link>

      {/* كارت العملاء */}
      <Link href="/admin/customers" className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition border-b-4 border-yellow-500 group">
        <h2 className="text-2xl font-bold mb-2 group-hover:text-yellow-600">🤝 إدارة العملاء</h2>
        <p className="text-gray-500">إضافة عملاء جدد وتعديل بياناتهم.</p>
      </Link>

       {/* كارت التقارير (مستقبلاً) */}
       <div className="bg-gray-200 p-8 rounded-xl shadow-inner border-b-4 border-gray-400 opacity-70">
        <h2 className="text-2xl font-bold mb-2">📊 التقارير (قريباً)</h2>
        <p className="text-gray-500">إحصائيات المبيعات والأرباح.</p>
      </div>

    </div>
  );
}