'use client'
import { useEffect, useState, use } from 'react';
import { getCustomerLedger } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ORDER' | 'RETURN' | 'PAYMENT'>('ALL');

  useEffect(() => {
    getCustomerLedger(id).then(result => {
      if (result.success) {
        setData(result.data);
      } else {
        alert('خطأ: ' + result.error);
        router.push('/admin/reports');
      }
      setLoading(false);
    });
  }, [id, router]);

  if (loading) {
    return <div className="p-10 text-center font-bold">جاري التحميل...</div>;
  }

  if (!data) {
    return <div className="p-10 text-center text-red-600">العميل غير موجود</div>;
  }

  const { customer, transactions, summary } = data;

  // فلترة الحركات
  const filteredTransactions = filter === 'ALL' 
    ? transactions 
    : transactions.filter((t: any) => t.type === filter);

  // طباعة التقرير
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
          body { print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 no-print">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📚 دفتر الأستاذ</h1>
            <p className="text-sm text-gray-600 mt-1">كشف حساب العميل</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold"
            >
              🖨️ طباعة
            </button>
            <Link
              href="/admin/reports"
              className="bg-gray-600 text-white px-4 py-2 rounded-lg font-bold"
            >
              ← رجوع
            </Link>
          </div>
        </div>
      </div>

      {/* معلومات العميل */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl shadow-lg mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs opacity-80">اسم العميل</div>
            <div className="font-bold text-lg">{customer.name}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">رقم الهاتف</div>
            <div className="font-bold text-lg">{customer.phone}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">العنوان</div>
            <div className="font-bold text-sm">{customer.address || '-'}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">المصدر</div>
            <div className="font-bold text-lg">{customer.source || '-'}</div>
          </div>
        </div>
      </div>

      {/* الملخص */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow border-r-4 border-blue-500">
          <div className="text-xs text-gray-600 mb-1">إجمالي الأوردرات</div>
          <div className="font-bold text-2xl text-blue-700">{summary.totalOrders}</div>
          <div className="text-xs text-gray-500">{summary.totalOrdersAmount.toFixed(2)} ج.م</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow border-r-4 border-green-500">
          <div className="text-xs text-gray-600 mb-1">إجمالي المرتجعات</div>
          <div className="font-bold text-2xl text-green-700">{summary.totalReturns}</div>
          <div className="text-xs text-gray-500">{summary.totalReturnsAmount.toFixed(2)} ج.م</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow border-r-4 border-purple-500">
          <div className="text-xs text-gray-600 mb-1">إجمالي المدفوعات</div>
          <div className="font-bold text-2xl text-purple-700">
            {summary.totalPaymentsIn.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">ج.م (وارد)</div>
        </div>
        <div className={`bg-white p-4 rounded-xl shadow border-r-4 ${
          summary.currentBalance > 0 ? 'border-red-500' : 'border-gray-500'
        }`}>
          <div className="text-xs text-gray-600 mb-1">الرصيد الحالي</div>
          <div className={`font-bold text-2xl ${
            summary.currentBalance > 0 ? 'text-red-700' : 'text-gray-700'
          }`}>
            {summary.currentBalance.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">ج.م {summary.currentBalance > 0 ? '(عليه)' : '(له)'}</div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="bg-white p-4 rounded-xl shadow mb-4 no-print">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              filter === 'ALL'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            📋 الكل ({transactions.length})
          </button>
          <button
            onClick={() => setFilter('ORDER')}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              filter === 'ORDER'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            🛒 الأوردرات ({transactions.filter((t: any) => t.type === 'ORDER').length})
          </button>
          <button
            onClick={() => setFilter('RETURN')}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              filter === 'RETURN'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            ↩️ المرتجعات ({transactions.filter((t: any) => t.type === 'RETURN').length})
          </button>
          <button
            onClick={() => setFilter('PAYMENT')}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              filter === 'PAYMENT'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-700'
            }`}
          >
            💰 النقدية ({transactions.filter((t: any) => t.type === 'PAYMENT').length})
          </button>
        </div>
      </div>

      {/* جدول الحركات */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-xs font-bold">التاريخ</th>
              <th className="p-3 text-xs font-bold">المرجع</th>
              <th className="p-3 text-xs font-bold">الوصف</th>
              <th className="p-3 text-xs font-bold text-center">مدين</th>
              <th className="p-3 text-xs font-bold text-center">دائن</th>
              <th className="p-3 text-xs font-bold text-center">الرصيد</th>
              <th className="p-3 text-xs font-bold">الموظف</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-gray-500">
                  لا توجد حركات
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t: any, idx: number) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-sm">
                    {new Date(t.date).toLocaleDateString('ar-EG')}
                    <div className="text-xs text-gray-500">
                      {new Date(t.date).toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-sm">{t.reference}</div>
                    {t.type === 'ORDER' && t.orderId && (
                      <Link 
                        href={`/orders/${t.orderId}/edit`}
                        className="text-xs text-blue-600 hover:underline no-print"
                      >
                        عرض التفاصيل
                      </Link>
                    )}
                    {t.type === 'RETURN' && t.returnId && (
                      <div className="text-xs text-orange-600">
                        مرتجع #{t.returnId.slice(-6)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-700">
                    {t.description}
                    {t.safe && (
                      <div className="text-xs text-gray-500">الخزنة: {t.safe}</div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {t.debit > 0 && (
                      <span className="font-bold text-red-600">
                        {t.debit.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {t.credit > 0 && (
                      <span className="font-bold text-green-600">
                        {t.credit.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className={`p-3 text-center font-bold ${
                    t.balance > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {t.balance.toFixed(2)}
                  </td>
                  <td className="p-3 text-sm text-gray-600">{t.user}</td>
                </tr>
              ))
            )}
          </tbody>
          {filteredTransactions.length > 0 && (
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan={3} className="p-3 text-left">الإجمالي:</td>
                <td className="p-3 text-center text-red-600">
                  {filteredTransactions.reduce((sum: number, t: any) => sum + t.debit, 0).toFixed(2)}
                </td>
                <td className="p-3 text-center text-green-600">
                  {filteredTransactions.reduce((sum: number, t: any) => sum + t.credit, 0).toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  {filteredTransactions[filteredTransactions.length - 1].balance.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* تفاصيل الحركات */}
      {filteredTransactions.some((t: any) => t.details && t.details.length > 0) && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold text-lg mb-4">📋 تفاصيل الحركات</h3>
          <div className="space-y-4">
            {filteredTransactions
              .filter((t: any) => t.details && t.details.length > 0)
              .map((t: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-bold text-blue-700">{t.reference}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(t.date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-right">الموديل</th>
                        <th className="p-2 text-right">اللون</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-center">السعر</th>
                        <th className="p-2 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.details.map((item: any, i: number) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-bold">{item.modelNo}</td>
                          <td className="p-2">{item.color}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-center">{item.price.toFixed(2)}</td>
                          <td className="p-2 text-center font-bold">
                            {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {t.details.some((item: any) => item.exchangedProduct) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-bold text-blue-600 mb-2">
                        🔄 الأصناف المستبدلة بها:
                      </div>
                      {t.details
                        .filter((item: any) => item.exchangedProduct)
                        .map((item: any, i: number) => (
                          <div key={i} className="text-sm flex gap-4">
                            <span className="font-bold">{item.exchangedProduct.modelNo}</span>
                            <span className="text-gray-600">{item.exchangedProduct.color}</span>
                            <span>× {item.exchangedProduct.quantity}</span>
                            <span className="font-bold">
                              {(item.exchangedProduct.quantity * item.exchangedProduct.price).toFixed(2)} ج.م
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
