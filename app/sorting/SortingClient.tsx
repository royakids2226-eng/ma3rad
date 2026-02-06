'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { executeOrderBatch } from './actions'; // استيراد الأكشن

// تعريف الأنواع
type ItemDetail = {
  id: string;
  orderItemId: string;
  modelNo: string;
  description: string;
  color: string;
  originalQtyDozens: number;
  totalQtyPieces: number;
  alreadyFulfilled: number;
  remainingNeeded: number;
  qtyAllocatedPieces: number; // المتاح للصرف الآن
  isFullyReady: boolean;
  price: number;
};

type OrderType = {
  id: string;
  orderNo: number;
  customer: { name: string; phone?: string | null; address?: string | null };
  createdAt: Date;
  readinessPercentage: number;
  itemsAllocatedNow: number;
  itemsPendingTotal: number;
  isCompletelyDone: boolean;
  itemDetails: ItemDetail[];
};

export default function SortingClient({ initialOrders }: { initialOrders: OrderType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);
  const [isPending, startTransition] = useTransition(); // للتحكم في حالة التحميل أثناء الحفظ

  // 1. منطق الفلترة والترتيب
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

  // 2. تجميع الأصناف للعرض في الفاتورة
  const getGroupedInvoiceItems = (items: ItemDetail[]) => {
    const groups: { [key: string]: any } = {};

    items.forEach((item) => {
      // نعرض فقط ما سيتم تنفيذه الآن أو ما هو مطلوب
      
      if (!groups[item.modelNo]) {
        groups[item.modelNo] = {
          ...item,
          colorCounts: { [item.color]: item.qtyAllocatedPieces }, // نعرض ألوان الكمية المتاحة الآن
          totalQtyDozens: item.originalQtyDozens,
          
          totalAlreadyFulfilled: item.alreadyFulfilled,
          totalRemaining: item.remainingNeeded,
          totalAllocatedNow: item.qtyAllocatedPieces,
        };
      } else {
        groups[item.modelNo].totalQtyDozens += item.originalQtyDozens;
        groups[item.modelNo].totalAlreadyFulfilled += item.alreadyFulfilled;
        groups[item.modelNo].totalRemaining += item.remainingNeeded;
        groups[item.modelNo].totalAllocatedNow += item.qtyAllocatedPieces;

        // تجميع الألوان للكمية الحالية
        if (groups[item.modelNo].colorCounts[item.color]) {
          groups[item.modelNo].colorCounts[item.color] += item.qtyAllocatedPieces;
        } else {
          groups[item.modelNo].colorCounts[item.color] = item.qtyAllocatedPieces;
        }
      }
    });

    return Object.values(groups).map((group: any) => {
        // نص الألوان: يعرض فقط الألوان التي سيتم صرفها في هذا الباتش
        const colorsDisplay = Object.entries(group.colorCounts)
          .filter(([_, qty]) => (qty as number) > 0) // فقط اللي فيه كمية
          .map(([color, qty]) => `${color} (${qty})`)
          .join(' + ');
        
        const fallbackColors = colorsDisplay === '' ? 'لا يوجد كميات متاحة' : colorsDisplay;

        return {
            ...group,
            colorsDisplay: fallbackColors,
            isFullyReady: group.totalAllocatedNow >= group.totalRemaining && group.totalRemaining > 0
        };
    });
  };

  const invoiceItems = useMemo(() => {
    if (!selectedOrder) return [];
    return getGroupedInvoiceItems(selectedOrder.itemDetails);
  }, [selectedOrder]);

  const handleExecuteAndPrint = async () => {
    if (!selectedOrder) return;

    if (!confirm('هل أنت متأكد من تنفيذ الكميات المتاحة وحفظها؟ سيتم خصمها من المخزون.')) return;

    // تجهيز البيانات للسيرفر
    const itemsToFulfill = selectedOrder.itemDetails
      .filter(item => item.qtyAllocatedPieces > 0)
      .map(item => ({
        orderItemId: item.orderItemId,
        qtyToFulfill: item.qtyAllocatedPieces
      }));

    if (itemsToFulfill.length === 0) {
        alert('لا توجد كميات متاحة للتنفيذ حالياً.');
        return;
    }

    startTransition(async () => {
        const result = await executeOrderBatch(selectedOrder.id, itemsToFulfill);
        if (result.success) {
            // نفتح الطباعة بعد الحفظ
            setTimeout(() => window.print(), 500);
            // إغلاق المودال سيحدث تلقائياً لأن الصفحة ستتحدث (revalidate) وقد يختفي الأوردر أو تتغير بياناته
            // لكن هنا سنبقيه مفتوحاً للطباعة، البيانات ستتحدث في الخلفية
        } else {
            alert('حدث خطأ أثناء الحفظ.');
        }
    });
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="print:hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📦 فرز الأوردرات (دفعات)</h1>
            <p className="text-slate-500 mt-1">يظهر هنا المتبقي من الأوردرات. النسبة تعبر عن توفر المتبقي.</p>
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
                    {order.readinessPercentage}% <span className="text-xs text-gray-400 font-normal">(من المتبقي)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                  <div className={`${statusColor} h-4 rounded-full`} style={{ width: `${order.readinessPercentage}%` }}></div>
                </div>

                <div className="flex justify-between items-center text-sm text-slate-600 mb-4">
                   <span>متبقي: {order.itemsPendingTotal} / متاح للصرف: {order.itemsAllocatedNow}</span>
                </div>

                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-bold flex justify-center items-center gap-2"
                >
                  📄 معاينة وتنفيذ الدفعة
                </button>
              </div>
            );
          })}
          {filteredAndSortedOrders.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
                لا توجد أوردرات معلقة (بها كميات متبقية).
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/*                  MODAL: PRINT VIEW                        */}
      {/* ========================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto bg-black bg-opacity-50 print:bg-white print:p-0">
          <div className="bg-white w-full max-w-4xl m-4 p-8 rounded-xl shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:m-0 print:rounded-none">
            
            <div className="flex justify-between mb-8 print:hidden border-b pb-4">
              <div>
                  <h2 className="text-xl font-bold">إذن صرف جزئي (Batch)</h2>
                  <p className="text-sm text-gray-500">الكميات الظاهرة هي المتاحة للصرف الآن فقط.</p>
              </div>
              <div className="flex gap-2">
                <button 
                    onClick={handleExecuteAndPrint} 
                    disabled={isPending || selectedOrder.itemsAllocatedNow === 0}
                    className={`px-4 py-2 rounded text-white flex items-center gap-2 ${isPending || selectedOrder.itemsAllocatedNow === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isPending ? 'جاري الحفظ...' : '💾 تنفيذ وطباعة'}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200">إغلاق</button>
              </div>
            </div>

            <div className="print:block" dir="rtl">
              <div className="text-center mb-8 border-b border-black pb-4">
                 <h1 className="text-3xl font-bold mb-2">طلب صرف بضاعة (جزئي)</h1>
                 <p className="text-gray-600">تاريخ الصرف: {new Date().toLocaleDateString('ar-EG')}</p>
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
                    <th className="border border-gray-300 p-2 text-right">ألوان (الصرف الحالي)</th>
                    <th className="border border-gray-300 p-2 text-center">المطلوب المتبقي</th>
                    <th className="border border-gray-300 p-2 text-center bg-gray-200 print:bg-gray-300">يصرف الآن (ق)</th>
                    <th className="border border-gray-300 p-2 text-center">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, index: number) => (
                    <tr key={index} className={item.totalAllocatedNow > 0 ? "" : "bg-red-50 print:bg-transparent"}>
                      <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-2">
                        <span className="font-bold text-lg">{item.modelNo}</span>
                        {item.description && <span className="text-gray-500 text-xs block">{item.description}</span>}
                      </td>
                      <td className="border border-gray-300 p-2 font-medium text-sm">{item.colorsDisplay}</td>
                      
                      {/* المتبقي قبل هذا الصرف */}
                      <td className="border border-gray-300 p-2 text-center text-gray-500">
                        {item.totalRemaining} ق
                      </td>

                      {/* الكمية التي ستصرف وتخصم الآن */}
                      <td className="border border-gray-300 p-2 text-center font-bold text-xl bg-gray-50 print:bg-gray-100">
                        {item.totalAllocatedNow > 0 ? item.totalAllocatedNow : '-'}
                      </td>

                      <td className="border border-gray-300 p-2 text-center">{item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center border-t border-black pt-4">
                <div>
                   <p>إجمالي المصروف في هذه الدفعة: <span className="font-bold">{selectedOrder.itemsAllocatedNow} قطعة</span></p>
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