'use client'
import { useEffect, useState, useCallback } from 'react';
import { getSummaryByDateRange } from "@/app/actions";
import Link from "next/link";

// Helpers
const formatMoney = (n: number) => (n || 0).toFixed(2);
const formatTime = (d: string) => new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });

// Components
const SummaryCard = ({ title, value, subtext, colorClass }: any) => (
  <div className={`text-white p-4 rounded-xl shadow-lg ${colorClass}`}>
    <div className="text-sm opacity-90">{title}</div>
    <div className="text-2xl font-black">{formatMoney(value)}</div>
    <div className="text-xs opacity-90">{subtext}</div>
  </div>
);

const Section = ({ title, children, count, total, currency = "ج.م" }: any) => (
  <div className="bg-white rounded-xl shadow p-4">
    <div className="flex justify-between items-center mb-3">
      <h2 className="font-bold text-lg">{title}</h2>
      {(count !== undefined && total !== undefined) && (
        <span className="text-sm text-gray-500">
          {count} {count > 2 ? "عمليات" : "عملية"} | {formatMoney(total)} {currency}
        </span>
      )}
    </div>
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {children}
    </div>
  </div>
);

// Main Page Component
export default function SummaryPage() {
  const today = new Date().toISOString().split('T')[0];
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState({ start: today, end: today });

  const fetchSummary = useCallback((start: string, end: string) => {
    setLoading(true);
    setError(null);
    getSummaryByDateRange(start, end)
      .then(result => {
        if (result.success) {
          setSummary(result.data);
        } else {
          setError(result.error || "فشل في جلب البيانات");
          setSummary(null);
        }
      })
      .catch(err => {
        console.error(err);
        setError("حدث خطأ غير متوقع.");
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary(dates.start, dates.end);
  }, [fetchSummary, dates.start, dates.end]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDates(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getTitle = () => {
    const { start, end } = summary.dateRange;
    if (start === end) {
        return `📊 ملخص يوم ${formatDate(start)}`;
    }
    return `📊 ملخص الفترة من ${formatDate(start)} إلى ${formatDate(end)}`;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 border-b-4 border-amber-500">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-black text-gray-800">
                {summary ? getTitle() : "📊 تقرير الملخص"}
            </h1>
            <Link href="/" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200">
                ← رجوع
            </Link>
        </div>
        <div className="flex items-center gap-4">
            <input type="date" name="start" value={dates.start} onChange={handleDateChange} className="input"/>
            <input type="date" name="end" value={dates.end} onChange={handleDateChange} className="input"/>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="text-center p-8 font-bold">جاري تحميل التقرير...</div>
        ) : error ? (
          <div className="text-center p-8 font-bold text-red-500 bg-white rounded-lg shadow">{error}</div>
        ) : !summary ? (
            <div className="text-center p-8 font-bold text-gray-500 bg-white rounded-lg shadow">لا توجد بيانات لهذه الفترة.</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard title="إجمالي المبيعات" value={summary.orders.total} subtext={`${summary.orders.count} فاتورة`} colorClass="bg-gradient-to-br from-blue-500 to-blue-700" />
                <SummaryCard title="صافي المبيعات" value={summary.products.totalRevenue} subtext="بعد خصم المرتجعات" colorClass="bg-gradient-to-br from-teal-500 to-teal-700" />
                <SummaryCard title="النقدية الداخلة" value={summary.payments.totalIn + summary.payments.totalCollection} subtext="قبض + تحصيل" colorClass="bg-gradient-to-br from-green-500 to-green-700" />
                <SummaryCard title="صافي النقدية" value={summary.payments.net} subtext="الداخل - الخارج" colorClass="bg-gradient-to-br from-purple-500 to-purple-700" />
            </div>
            
            {/* Sales & Returns Section */}
            <div className="grid md:grid-cols-2 gap-6">
                <Section title="الأوردرات حسب العميل" count={summary.orders.count} total={summary.orders.total}>
                    {Object.keys(summary.orders.byCustomer).length === 0 ? <p className="text-center text-gray-400">لا توجد فواتير</p> : Object.entries(summary.orders.byCustomer).map(([customer, data]: [string, any]) => (
                        <div key={customer} className="border rounded-lg p-2">
                            <div className="flex justify-between items-center mb-1">
                                <div className="font-bold">👤 {customer}</div>
                                <div className="text-sm text-green-700 font-bold">{formatMoney(data.total)} ج.م</div>
                            </div>
                            {data.orders.map((order: any) => (
                              <Link key={order.id} href={`/orders/${order.id}/print`} className="flex justify-between items-center text-xs bg-gray-50 hover:bg-blue-50 p-1.5 rounded">
                                <div>فاتورة #{order.orderNo} <span className="text-gray-400">• {formatTime(order.time)}</span></div>
                                <span className="font-bold">{formatMoney(order.total)} ج.م</span>
                              </Link>
                            ))}
                        </div>
                    ))}
                </Section>

                <Section title="المرتجعات حسب العميل" count={summary.returns.count} total={summary.returns.totalValue}>
                     {Object.keys(summary.returns.byCustomer).length === 0 ? <p className="text-center text-gray-400">لا توجد مرتجعات</p> : Object.entries(summary.returns.byCustomer).map(([customer, data]: [string, any]) => (
                        <div key={customer} className="border rounded-lg p-2">
                            <div className="flex justify-between items-center mb-1">
                                <div className="font-bold">👤 {customer}</div>
                                <div className="text-sm text-red-700 font-bold">{formatMoney(data.totalValue)} ج.م</div>
                            </div>
                            {data.returns.map((ret: any) => (
                              <Link key={ret.id} href={`/admin/returns/${ret.id}/edit`} className="flex justify-between items-center text-xs bg-gray-50 hover:bg-red-50 p-1.5 rounded">
                                <div>مرتجع #{ret.returnNo} <span className="text-gray-400">• {formatTime(ret.time)}</span></div>
                                <span className="font-bold">{formatMoney(ret.value)} ج.م</span>
                              </Link>
                            ))}
                        </div>
                    ))}
                </Section>
            </div>

            {/* Cash Flow & Vendor Summary */}
            <div className="grid md:grid-cols-2 gap-6">
                <Section title="🏦 حركة النقدية بالخزن">
                    {Object.keys(summary.payments.bySafe).length === 0 ? <p className="text-center text-gray-400">لا توجد حركة نقدية</p> : Object.entries(summary.payments.bySafe).map(([safe, data]: [string, any]) => (
                        <div key={safe} className="border rounded-lg p-3">
                            <div className="font-bold text-center mb-2">🏦 {safe}</div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between bg-green-50 p-1 rounded"><span>قبض فوري</span> <span className="font-bold">{formatMoney(data.in)}</span></div>
                                <div className="flex justify-between bg-blue-50 p-1 rounded"><span>تحصيل آجل</span> <span className="font-bold">{formatMoney(data.collection)}</span></div>
                                <div className="flex justify-between bg-red-50 p-1 rounded"><span>مرتجعات نقدية</span> <span className="font-bold text-red-600">-{formatMoney(data.refund)}</span></div>
                                <div className="flex justify-between bg-orange-50 p-1 rounded"><span>مصروفات</span> <span className="font-bold text-orange-600">-{formatMoney(data.out)}</span></div>
                                <div className={`flex justify-between bg-gray-100 p-2 mt-2 font-bold ${data.in + data.collection - data.out - data.refund >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                    <span>الصافي</span> 
                                    <span>{formatMoney(data.in + data.collection - data.out - data.refund)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </Section>

                <Section title="ملخص مبيعات الموردين" count={summary.products.totalQuantity} total={summary.products.totalRevenue} currency="قطعة">
                     {summary.products.byVendor.length === 0 ? <p className="text-center text-gray-400">لا توجد أصناف مباعة</p> : summary.products.byVendor.map((vendor: any) => (
                        <div key={vendor.vendor} className="grid grid-cols-4 gap-4 items-center border-b pb-2 text-sm">
                            <div className="col-span-1 font-bold">🏪 {vendor.vendor}</div>
                            <div><span className="font-bold">{vendor.models}</span> <span className="text-xs">موديل</span></div>
                            <div><span className="font-bold">{vendor.quantity}</span> <span className="text-xs">قطعة</span></div>
                            <div className="font-bold text-green-700 text-left">{formatMoney(vendor.revenue)} <span className="text-xs">ج.م</span></div>
                        </div>
                     ))}
                </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
