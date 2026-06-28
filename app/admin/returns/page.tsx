'use client'
import { useEffect, useState } from 'react';
import { getReturnOrders, getReturnById } from '@/app/actions';
import Link from 'next/link';

export default function ReturnsListPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  useEffect(() => {
    getReturnOrders().then(data => {
      setReturns(data);
      setLoading(false);
    });
  }, []);

  const handlePrint = async (returnId: string) => {
    const data = await getReturnById(returnId);
    if (data) {
      setSelectedReturn(data);
      setTimeout(() => window.print(), 300);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-purple-500 no-print">
        <h1 className="text-2xl font-bold">📋 سجل المرتجعات</h1>
        <Link href="/orders/list" className="text-sm text-blue-600 font-bold">
          العودة للأوردرات
        </Link>
      </div>

      {returns.length === 0 ? (
        <div className="bg-white p-10 rounded-xl shadow text-center text-gray-500">
          لا توجد مرتجعات مسجلة
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden no-print">
          <table className="w-full text-right">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">رقم المرتجع</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الأوردر الأصلي</th>
                <th className="p-3">الأوردر الجديد</th>
                <th className="p-3">القيمة</th>
                <th className="p-3">فرق الاستبدال</th>
                <th className="p-3">السبب</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret: any) => (
                <tr key={ret.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-bold">#{ret.returnNo}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      ret.type === 'FULL' ? 'bg-red-100 text-red-700' :
                      ret.type === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {ret.type === 'FULL' ? '🔴 كامل' : ret.type === 'PARTIAL' ? '🟡 جزئي' : '🔵 استبدال'}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link href={`/orders/${ret.originalOrderId}/edit`} className="text-blue-600 underline">
                      #{ret.originalOrder?.orderNo}
                    </Link>
                  </td>
                  <td className="p-3">
                    {ret.newOrderId ? (
                      <Link href={`/orders/${ret.newOrderId}/edit`} className="text-green-600 underline">
                        #{ret.newOrder?.orderNo}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="p-3 font-bold">{ret.totalRefund.toFixed(2)} ج.م</td>
                  <td className={`p-3 font-bold ${
                    ret.exchangeAmount > 0 ? 'text-red-600' : 
                    ret.exchangeAmount < 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {ret.exchangeAmount > 0 ? '+' : ''}{ret.exchangeAmount.toFixed(2)} ج.م
                  </td>
                  <td className="p-3 text-sm text-gray-600">{ret.reason || '-'}</td>
                  <td className="p-3 text-sm">
                    {new Date(ret.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handlePrint(ret.id)}
                      className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200"
                    >
                      🖨️ طباعة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* منطقة الطباعة - تظهر فقط عند الطباعة */}
      {selectedReturn && (
        <div id="print-area" className="bg-white p-8 max-w-2xl mx-auto">
          <div className="border-2 border-gray-300 p-6 rounded-lg">
            <div className="border-b-2 border-black pb-4 mb-6 text-center">
              <h1 className="text-3xl font-bold mb-2">إيصال مرتجع</h1>
              <div className="text-xl font-bold">#{selectedReturn.returnNo}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <div className="text-gray-600 mb-1">الأوردر الأصلي:</div>
                <div className="font-bold text-lg">#{selectedReturn.originalOrder.orderNo}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">التاريخ:</div>
                <div className="font-bold">
                  {new Date(selectedReturn.createdAt).toLocaleDateString('ar-EG')}
                </div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">العميل:</div>
                <div className="font-bold">{selectedReturn.originalOrder.customer.name}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">النوع:</div>
                <div className="font-bold">
                  {selectedReturn.type === 'FULL' ? ' مرتجع كامل' :
                   selectedReturn.type === 'PARTIAL' ? '🟡 مرتجع جزئي' :
                   '🔵 استبدال'}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 border-b border-gray-300 pb-2">
                الأصناف المرتجعة:
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-right">الموديل</th>
                    <th className="p-2 text-right">اللون</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-center">السعر</th>
                    <th className="p-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturn.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2 font-bold">{item.product.modelNo}</td>
                      <td className="p-2">{item.product.color}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-center">{item.unitPrice.toFixed(2)} ج.م</td>
                      <td className="p-2 text-center font-bold">
                        {item.refundAmount.toFixed(2)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedReturn.type === 'EXCHANGE' && selectedReturn.items.some((item: any) => item.exchangedProductId) && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 border-b border-gray-300 pb-2">
                  الأصناف المستبدلة بها:
                </h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-right">الموديل</th>
                      <th className="p-2 text-right">اللون</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">السعر</th>
                      <th className="p-2 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturn.items.map((item: any, idx: number) => (
                      item.exchangedProductId && (
                        <tr key={idx} className="border-b">
                          <td className="p-2 font-bold">{item.exchangedProduct.modelNo}</td>
                          <td className="p-2">{item.exchangedProduct.color}</td>
                          <td className="p-2 text-center">{item.exchangedQty}</td>
                          <td className="p-2 text-center">{item.exchangedPrice.toFixed(2)} ج.م</td>
                          <td className="p-2 text-center font-bold">
                            {(item.exchangedQty * item.exchangedPrice).toFixed(2)} ج.م
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t-2 border-black pt-4 mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">إجمالي المرتجع:</span>
                <span className="font-bold text-xl">{selectedReturn.totalRefund.toFixed(2)} ج.م</span>
              </div>
              
              {selectedReturn.type === 'EXCHANGE' && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">قيمة الأصناف البديلة:</span>
                    <span className="font-bold text-xl">
                      {(selectedReturn.totalRefund + selectedReturn.exchangeAmount).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded ${
                    selectedReturn.exchangeAmount > 0 ? 'bg-red-50' :
                    selectedReturn.exchangeAmount < 0 ? 'bg-green-50' : 'bg-gray-50'
                  }`}>
                    <span className="font-bold text-lg">فرق السعر:</span>
                    <span className={`font-bold text-2xl ${
                      selectedReturn.exchangeAmount > 0 ? 'text-red-600' :
                      selectedReturn.exchangeAmount < 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {selectedReturn.exchangeAmount > 0 ? '+' : ''}
                      {selectedReturn.exchangeAmount.toFixed(2)} ج.م
                    </span>
                  </div>
                  {selectedReturn.exchangeAmount > 0 && (
                    <p className="text-sm text-red-600 mt-2">العميل يدفع الفرق</p>
                  )}
                  {selectedReturn.exchangeAmount < 0 && (
                    <p className="text-sm text-green-600 mt-2">يُسترد للعميل</p>
                  )}
                </>
              )}
            </div>

            {selectedReturn.notes && (
              <div className="mt-6 p-4 bg-gray-50 rounded">
                <div className="text-gray-600 text-sm mb-1">ملاحظات:</div>
                <div className="text-sm">{selectedReturn.notes}</div>
              </div>
            )}

            {selectedReturn.reason && (
              <div className="mt-4">
                <div className="text-gray-600 text-sm mb-1">السبب:</div>
                <div className="text-sm">{selectedReturn.reason}</div>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
              <div>شكراً لثقتكم بنا</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}