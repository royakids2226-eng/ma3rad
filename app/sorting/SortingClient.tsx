'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// تعريف الأنواع
type ItemDetail = {
  id: string;
  modelNo: string;
  description: string;
  color: string;
  originalQty: number;
  qtyNeededPieces: number;
  qtyAllocatedPieces: number;
  isFullyReady: boolean;
  price: number;
};

type OrderType = {
  id: string;
  orderNo: number;
  customer: { name: string; phone?: string | null; address?: string | null };
  createdAt: Date;
  readinessPercentage: number;
  itemsAllocated: number;
  itemsTotal: number;
  itemDetails: ItemDetail[];
};

export default function SortingClient({ initialOrders }: { initialOrders: OrderType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);

  // 1. منطق الفلترة والترتيب للقائمة الرئيسية
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...initialOrders];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(lowerTerm) ||
          o.orderNo.toString().includes(lowerTerm)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'ready-desc': return b.readinessPercentage - a.readinessPercentage;
        case 'ready-asc': return a.readinessPercentage - b.readinessPercentage;
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date-desc': default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [initialOrders, searchTerm, sortBy]);

  // 2. دالة تجميع الأصناف (Grouping) لجدول الطباعة
  const getGroupedInvoiceItems = (items: ItemDetail[]) => {
    const groups: { [key: string]: any } = {};

    items.forEach((item) => {
      if (!groups[item.modelNo]) {
        groups[item.modelNo] = {
          ...item,
          colors: [item.color],
          totalQty: item.originalQty, // إجمالي الكمية (د)
          totalNeededPieces: item.qtyNeededPieces,
          totalAllocatedPieces: item.qtyAllocatedPieces,
        };
      } else {
        groups[item.modelNo].colors.push(item.color);
        groups[item.modelNo].totalQty += item.originalQty;
        groups[item.modelNo].totalNeededPieces += item.qtyNeededPieces;
        groups[item.modelNo].totalAllocatedPieces += item.qtyAllocatedPieces;
      }
    });

    return Object.values(groups).map((group: any) => ({
      ...group,
      colorsDisplay: [...new Set(group.colors)].join(' + '),
      isFullyReady: group.totalAllocatedPieces >= group.totalNeededPieces
    }));
  };

  const invoiceItems = useMemo(() => {
    if (!selectedOrder) return [];
    return getGroupedInvoiceItems(selectedOrder.itemDetails);
  }, [selectedOrder]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="print:hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📦 فرز الأوردرات</h1>
            <p className="text-slate-500 mt-1">توزيع الكميات بأولوية الحجز (FIFO)</p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors h-10 flex items-center">
              الرئيسية
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row gap-4 border border-slate-100">
          <input 
            type="text" 
            placeholder="ابحث باسم العميل أو رقم الأوردر..." 
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="w-full md:w-64 p-2 border border-slate-200 rounded-lg bg-white"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-desc">التاريخ: الأحدث أولاً</option>
            <option value="ready-desc">الجاهزية: الأعلى أولاً</option>
          </select>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedOrders.map((order) => {
             let statusColor = "bg-red-500";
             let statusText = "text-red-600";
             if (order.readinessPercentage === 100) {
                statusColor = "bg-emerald-500";
                statusText = "text-emerald-600";
             } else if (order.readinessPercentage > 0) {
                statusColor = "bg-amber-500";
                statusText = "text-amber-600";
             }

            return (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-5 border border-slate-100 relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{order.customer.name}</h2>
                    <span className="text-sm text-slate-500">#{order.orderNo}</span>
                  </div>
                  <div className={`text-xl font-bold ${statusText}`}>
                    {order.readinessPercentage}%
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                  <div className={`${statusColor} h-4 rounded-full`} style={{ width: `${order.readinessPercentage}%` }}></div>
                </div>

                <div className="flex justify-between items-center text-sm text-slate-600 mb-4">
                   <span>مطلوب: {order.itemsTotal} / محجوز: {order.itemsAllocated}</span>
                </div>

                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-bold flex justify-center items-center gap-2"
                >
                  📄 تنفيذ وطباعة الأوردر
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/*                  MODAL: PRINT VIEW                        */}
      {/* ========================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto bg-black bg-opacity-50 print:bg-white print:p-0">
          <div className="bg-white w-full max-w-4xl m-4 p-8 rounded-xl shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:m-0 print:rounded-none">
            
            <div className="flex justify-between mb-8 print:hidden border-b pb-4">
              <h2 className="text-xl font-bold">معاينة الفاتورة</h2>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">🖨️ طباعة</button>
                <button onClick={() => setSelectedOrder(null)} className="bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200">إغلاق</button>
              </div>
            </div>

            <div className="print:block" dir="rtl">
              <div className="text-center mb-8 border-b border-black pb-4">
                 <h1 className="text-3xl font-bold mb-2">طلب صرف بضاعة</h1>
                 <p className="text-gray-600">تاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-4 rounded print:bg-transparent print:p-0 print:border print:border-gray-300">
                <div>
                  <p className="text-gray-500 text-sm">اسم العميل</p>
                  <p className="font-bold text-lg">{selectedOrder.customer.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">رقم الأوردر</p>
                  <p className="font-bold text-lg">#{selectedOrder.orderNo}</p>
                </div>
                {selectedOrder.customer.phone && (
                   <div><p className="text-gray-500 text-sm">الهاتف</p><p>{selectedOrder.customer.phone}</p></div>
                )}
                {selectedOrder.customer.address && (
                   <div><p className="text-gray-500 text-sm">العنوان</p><p>{selectedOrder.customer.address}</p></div>
                )}
              </div>

              {/* الجدول */}
              <table className="w-full border-collapse border border-gray-300 mb-8">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="border border-gray-300 p-2 text-right w-12">#</th>
                    <th className="border border-gray-300 p-2 text-right">الموديل</th>
                    <th className="border border-gray-300 p-2 text-right">الألوان</th>
                    {/* تم تغيير العنوان هنا من (د) إلى (قطعة) */}
                    <th className="border border-gray-300 p-2 text-center">الكمية (قطعة)</th>
                    <th className="border border-gray-300 p-2 text-center">السعر</th>
                    <th className="border border-gray-300 p-2 text-center w-24">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, index: number) => (
                    <tr key={index} className={item.isFullyReady ? "" : "bg-red-50 print:bg-transparent"}>
                      <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-2">
                        <span className="font-bold text-lg">{item.modelNo}</span>
                        {item.description && <span className="text-gray-500 text-xs block">{item.description}</span>}
                      </td>
                      <td className="border border-gray-300 p-2 font-medium">{item.colorsDisplay}</td>
                      {/* تم ضرب الكمية هنا في 4 لتصبح بالقطعة بدلاً من الدرزن */}
                      <td className="border border-gray-300 p-2 text-center font-bold text-lg">{item.totalQty * 4}</td>
                      <td className="border border-gray-300 p-2 text-center">{item.price}</td>
                      <td className="border border-gray-300 p-2 text-center">
                        {item.isFullyReady ? (
                          <span className="text-emerald-600 font-bold text-xl">✔</span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-red-500 font-bold text-xl">❌</span>
                            {item.totalAllocatedPieces > 0 && (
                                <span className="text-[12px] text-gray-700 whitespace-nowrap font-bold mt-1">
                                    {/* هنا أيضاً نتأكد من العرض */}
                                    متاح: {item.totalAllocatedPieces * 4} ق
                                </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center border-t border-black pt-4">
                <div>
                   <p>نسبة الجاهزية: <span className="font-bold">{selectedOrder.readinessPercentage}%</span></p>
                </div>
                <div className="text-left">
                   <p className="mb-8">توقيع المستلم: ..........................</p>
                   <p>توقيع أمين المخزن: ..........................</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}