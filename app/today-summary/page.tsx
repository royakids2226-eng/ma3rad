'use client'
import { useEffect, useState } from 'react';
import { getTodaySummary } from "@/app/actions";
import Link from "next/link";

// Helper to format money
const formatMoney = (n: number) => (n || 0).toFixed(2);

// Helper to format time
const formatTime = (d: string) => new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

// Summary Card Component
const SummaryCard = ({ title, value, subtext, colorClass }: any) => (
  <div className={`text-white p-4 rounded-xl shadow-lg ${colorClass}`}>
    <div className="text-sm opacity-90">{title}</div>
    <div className="text-2xl font-black">{formatMoney(value)}</div>
    <div className="text-xs opacity-90">{subtext}</div>
  </div>
);

export default function TodaySummaryPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTodaySummary()
      .then(result => {
        if (result.success) {
          setSummary(result.data);
        } else {
          setError(result.error || "فشل في جلب البيانات");
        }
      })
      .catch(err => {
        console.error(err);
        setError("حدث خطأ غير متوقع.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center font-bold">جاري تحميل ملخص اليوم...</div>;
  }

  if (error) {
    return <div className="p-8 text-center font-bold text-red-500">{error}</div>;
  }

  if (!summary) {
    return <div className="p-8 text-center font-bold">لا توجد بيانات لعرضها.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-amber-500">
          <div>
              <h1 className="text-xl font-black text-gray-800">📊 ملخص اليوم</h1>
              <p className="text-xs text-gray-500">
                  {new Date(summary.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
          </div>
          <Link href="/" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200">
              ← رجوع
          </Link>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard title="إجمالي المبيعات" value={summary.orders.total} subtext={`${summary.orders.count} فاتورة`} colorClass="bg-gradient-to-br from-blue-500 to-blue-700" />
          <SummaryCard title="صافي المبيعات" value={summary.products.totalRevenue} subtext="بعد خصم المرتجعات" colorClass="bg-gradient-to-br from-teal-500 to-teal-700" />
          <SummaryCard title="النقدية الداخلة" value={summary.payments.totalIn + summary.payments.totalCollection} subtext="قبض + تحصيل" colorClass="bg-gradient-to-br from-green-500 to-green-700" />
          <SummaryCard title="صافي النقدية" value={summary.payments.net} subtext="الداخل - الخارج" colorClass="bg-gradient-to-br from-purple-500 to-purple-700" />
        </div>
        
        {/* Sales & Returns Section */}
        <div className="grid md:grid-cols-2 gap-6">
            {/* Orders By Customer */}
            <div className="bg-white rounded-xl shadow p-4">
                <h2 className="font-bold text-lg mb-3">الأوردرات حسب العميل ({summary.orders.count})</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(summary.orders.byCustomer).map(([customer, data]: [string, any]) => (
                    <div key={customer} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold">👤 {customer}</div>
                            <div className="text-sm text-green-700 font-bold">{formatMoney(data.total)} ج.م</div>
                        </div>
                         {data.orders.map((order: any) => (
                          <Link key={order.id} href={`/orders/${order.id}/print`} className="flex justify-between items-center text-xs bg-gray-50 hover:bg-blue-50 p-2 rounded">
                            <div>فاتورة #{order.orderNo} <span className="text-gray-400">• {formatTime(order.time)}</span></div>
                            <span className="font-bold">{formatMoney(order.total)} ج.م</span>
                          </Link>
                        ))}
                    </div>
                ))}
                </div>
            </div>

            {/* Returns By Customer */}
            <div className="bg-white rounded-xl shadow p-4">
                <h2 className="font-bold text-lg mb-3">المرتجعات حسب العميل ({summary.returns.count})</h2>
                 <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(summary.returns.byCustomer).map(([customer, data]: [string, any]) => (
                    <div key={customer} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold">👤 {customer}</div>
                            <div className="text-sm text-red-700 font-bold">{formatMoney(data.totalValue)} ج.م</div>
                        </div>
                         {data.returns.map((ret: any) => (
                          <Link key={ret.id} href={`/admin/returns/${ret.id}/edit`} className="flex justify-between items-center text-xs bg-gray-50 hover:bg-red-50 p-2 rounded">
                            <div>مرتجع #{ret.returnNo} <span className="text-gray-400">• {formatTime(ret.time)}</span></div>
                            <span className="font-bold">{formatMoney(ret.value)} ج.م</span>
                          </Link>
                        ))}
                    </div>
                ))}
                </div>
            </div>
        </div>

        {/* Cash Flow By Safe */}
        <div className="bg-white rounded-xl shadow p-4">
             <h2 className="font-bold text-lg mb-3">🏦 حركة النقدية بالخزن</h2>
             <div className="grid md:grid-cols-3 gap-4">
                 {Object.entries(summary.payments.bySafe).map(([safe, data]: [string, any]) => (
                    <div key={safe} className="border rounded-lg p-3">
                        <div className="font-bold text-center mb-2">🏦 {safe}</div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between bg-green-50 p-1 rounded"><span>قبض فوري</span> <span className="font-bold">{formatMoney(data.in)}</span></div>
                            <div className="flex justify-between bg-blue-50 p-1 rounded"><span>تحصيل آجل</span> <span className="font-bold">{formatMoney(data.collection)}</span></div>
                            <div className="flex justify-between bg-red-50 p-1 rounded"><span>مرتجعات نقدية</span> <span className="font-bold text-red-600">-{formatMoney(data.refund)}</span></div>
                            <div className="flex justify-between bg-orange-50 p-1 rounded"><span>مصروفات</span> <span className="font-bold text-orange-600">-{formatMoney(data.out)}</span></div>
                            <div className="flex justify-between bg-gray-100 p-2 mt-2 font-bold"><span>الصافي</span> <span>{formatMoney(data.in + data.collection - data.out - data.refund)}</span></div>
                        </div>
                    </div>
                 ))}
             </div>
        </div>

        {/* Vendor Summary */}
        <div className="bg-white rounded-xl shadow p-4">
             <h2 className="font-bold text-lg mb-3">ملخص مبيعات الموردين</h2>
             <div className="space-y-2">
                 {summary.products.byVendor.map((vendor: any) => (
                    <div key={vendor.vendor} className="grid grid-cols-4 gap-4 items-center border-b pb-2">
                        <div className="col-span-1 font-bold">🏪 {vendor.vendor}</div>
                        <div><span className="font-bold">{vendor.models}</span> <span className="text-xs">موديل</span></div>
                        <div><span className="font-bold">{vendor.quantity}</span> <span className="text-xs">قطعة</span></div>
                        <div className="font-bold text-green-700 text-left">{formatMoney(vendor.revenue)} <span className="text-xs">ج.م</span></div>
                    </div>
                 ))}
             </div>
        </div>

      </div>
    </div>
  );
}
