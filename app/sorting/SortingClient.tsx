'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { executeOrderBatch } from './actions';

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
  
  // وضع العرض داخل المودال: 'batch' (للصرف الحالي) أو 'history' (لما تم تنفيذه سابقاً)
  const [printMode, setPrintMode] = useState<'batch' | 'history'>('batch');
  
  const [isPending, startTransition] = useTransition();

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
      if (!groups[item.modelNo]) {
        groups[item.modelNo] = {
          ...item,
          // تجميع ألوان الكمية المتاحة حالياً
          colorCountsBatch: item.qtyAllocatedPieces > 0 ? { [item.color]: item.qtyAllocatedPieces } : {},
          // تجميع ألوان الكمية المنفذة سابقاً
          colorCountsHistory: item.alreadyFulfilled > 0 ? { [item.color]: item.alreadyFulfilled } : {},
          
          totalQtyDozens: item.originalQtyDozens,
          totalQtyPieces: item.totalQtyPieces,
          
          totalAlreadyFulfilled: item.alreadyFulfilled,
          totalRemaining: item.remainingNeeded,
          totalAllocatedNow: item.qtyAllocatedPieces,
        };
      } else {
        groups[item.modelNo].totalQtyDozens += item.originalQtyDozens;
        groups[item.modelNo].totalQtyPieces += item.totalQtyPieces;
        groups[item.modelNo].totalAlreadyFulfilled += item.alreadyFulfilled;
        groups[item.modelNo].totalRemaining += item.remainingNeeded;
        groups[item.modelNo].totalAllocatedNow += item.qtyAllocatedPieces;

        // تجميع الألوان للباتش الحالي
        if (item.qtyAllocatedPieces > 0) {
            if (groups[item.modelNo].colorCountsBatch[item.color]) {
                groups[item.modelNo].colorCountsBatch[item.color] += item.qtyAllocatedPieces;
            } else {
                groups[item.modelNo].colorCountsBatch[item.color] = item.qtyAllocatedPieces;
            }
        }

        // تجميع الألوان للسجل السابق
        if (item.alreadyFulfilled > 0) {
            if (groups[item.modelNo].colorCountsHistory[item.color]) {
                groups[item.modelNo].colorCountsHistory[item.color] += item.alreadyFulfilled;
            } else {
                groups[item.modelNo].colorCountsHistory[item.color] = item.alreadyFulfilled;
            }
        }
      }
    });

    return Object.values(groups).map((group: any) => {
        // تنسيق عرض الألوان بناءً على الوضع
        const formatColors = (counts: any) => Object.entries(counts)
          .map(([color, qty]) => `${color} (${qty})`)
          .join(' + ');
        
        const batchColors = formatColors(group.colorCountsBatch);
        const historyColors = formatColors(group.colorCountsHistory);

        return {
            ...group,
            batchColorsDisplay: batchColors === '' ? '-' : batchColors,
            historyColorsDisplay: historyColors === '' ? '-' : historyColors,
            // تحديد الحالة (صح/خطأ) بناءً على الوضع
            isReadyInBatch: group.totalAllocatedNow > 0,
            hasHistory: group.totalAlreadyFulfilled > 0,
            isFullyDone: group.totalRemaining === 0
        };
    });
  };

  const invoiceItems = useMemo(() => {
    if (!selectedOrder) return [];
    return getGroupedInvoiceItems(selectedOrder.itemDetails);
  }, [selectedOrder]);

  const handleExecuteAndPrint = async () => {
    if (!selectedOrder) return;
    if (printMode === 'history') {
        window.print();
        return;
    }

    if (!confirm('هل أنت متأكد من تنفيذ الكميات المتاحة وحفظها؟ سيتم خصمها من المخزون.')) return;

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
            setTimeout(() => window.print(), 500);
        } else {
            alert('حدث خطأ أثناء الحفظ.');
        }
    });
  };

  // عند فتح المودال، نحدد الوضع الافتراضي
  const openModal = (order: OrderType) => {
    setSelectedOrder(order);
    // إذا لم يكن هناك شيء متاح للصرف الآن، نذهب تلقائياً لوضع التاريخ (السجل)
    if (order.itemsAllocatedNow === 0 && order.itemsPendingTotal < order.itemDetails.reduce((a, b) => a + b.totalQtyPieces, 0)) {
        setPrintMode('history');
    } else {
        setPrintMode('batch');
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="print:hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📦 فرز الأوردرات (دفعات)</h1>
            <p className="text-slate-500 mt-1">إدارة صرف البضاعة (FIFO) وطباعة أذونات الصرف.</p>
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
                    {order.readinessPercentage}% <span className="text-xs text-gray-400 font-normal">(متاح)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                  <div className={`${statusColor} h-4 rounded-full`} style={{ width: `${order.readinessPercentage}%` }}></div>
                </div>

                <div className="flex justify-between items-center text-sm text-slate-600 mb-4">
                   <span>متبقي: {order.itemsPendingTotal} / جاهز للصرف: {order.itemsAllocatedNow}</span>
                </div>

                <button 
                  onClick={() => openModal(order)}
                  className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-bold flex justify-center items-center gap-2"
                >
                  📄 معاينة / طباعة
                </button>
              </div>
            );
          })}
          {filteredAndSortedOrders.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
                لا توجد أوردرات مطابقة للبحث.
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
            
            {/* أزرار التحكم - لا تظهر في الطباعة */}
            <div className="flex flex-col gap-4 mb-8 print:hidden border-b pb-4">
              <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">معاينة إذن الصرف</h2>
                  <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-red-500 text-2xl font-bold">&times;</button>
              </div>
              
              {/* تبديل الوضع */}
              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => setPrintMode('batch')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${printMode === 'batch' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    الدفعة الحالية (جاهز للصرف)
                </button>
                <button 
                    onClick={() => setPrintMode('history')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${printMode === 'history' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    سجل التنفيذ السابق (إعادة طباعة)
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button 
                    onClick={handleExecuteAndPrint} 
                    disabled={isPending || (printMode === 'batch' && selectedOrder.itemsAllocatedNow === 0)}
                    className={`px-6 py-2 rounded text-white flex items-center gap-2 font-bold shadow-md
                        ${isPending || (printMode === 'batch' && selectedOrder.itemsAllocatedNow === 0) 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : printMode === 'batch' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                >
                    {isPending ? 'جاري الحفظ...' : (printMode === 'batch' ? '💾 تنفيذ وطباعة الدفعة' : '🖨️ طباعة السجل السابق')}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200">إغلاق</button>
              </div>

              {printMode === 'batch' && selectedOrder.itemsAllocatedNow === 0 && (
                  <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded border border-amber-200 text-sm">
                      ⚠️ تنبيه: لا توجد كميات متوفرة حالياً للصرف في هذا الأوردر. يمكنك التبديل لوضع "سجل التنفيذ السابق" لطباعة ما تم صرفه سابقاً.
                  </div>
              )}
            </div>

            {/* ورقة الطباعة */}
            <div className="print:block" dir="rtl">
              <div className="text-center mb-8 border-b border-black pb-4">
                 <h1 className="text-3xl font-bold mb-2">
                    {printMode === 'batch' ? 'إذن صرف بضاعة (دفعة جديدة)' : 'تقرير صرف بضاعة (سجل سابق)'}
                 </h1>
                 <p className="text-gray-600">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
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
                  <tr className="bg-gray-100 print:bg-gray-200 text-sm">
                    <th className="border border-gray-300 p-2 w-10">م</th>
                    <th className="border border-gray-300 p-2 w-10">حالة</th>
                    <th className="border border-gray-300 p-2 text-right">الموديل</th>
                    <th className="border border-gray-300 p-2 text-right">
                        {printMode === 'batch' ? 'ألوان (الصرف الحالي)' : 'ألوان (تم صرفها)'}
                    </th>
                    <th className="border border-gray-300 p-2 text-center w-20">المطلوب (الكل)</th>
                    
                    {printMode === 'batch' ? (
                        <>
                             <th className="border border-gray-300 p-2 text-center w-24 bg-gray-200 print:bg-gray-300 font-bold">يصرف الآن</th>
                             <th className="border border-gray-300 p-2 text-center w-20 text-gray-500">متبقي</th>
                        </>
                    ) : (
                        <>
                             <th className="border border-gray-300 p-2 text-center w-24 bg-gray-200 print:bg-gray-300 font-bold">تم صرفه</th>
                             <th className="border border-gray-300 p-2 text-center w-20 text-gray-500">متبقي</th>
                        </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, index: number) => {
                    // تحديد الحالة والعلامة
                    let isCheck = false;
                    let displayQty = 0;
                    let colorsDisplay = '';

                    if (printMode === 'batch') {
                        isCheck = item.isReadyInBatch;
                        displayQty = item.totalAllocatedNow;
                        colorsDisplay = item.batchColorsDisplay;
                    } else {
                        isCheck = item.hasHistory;
                        displayQty = item.totalAlreadyFulfilled;
                        colorsDisplay = item.historyColorsDisplay;
                    }

                    return (
                        <tr key={index} className="text-sm">
                        <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                        
                        {/* عمود الصح والخطأ */}
                        <td className="border border-gray-300 p-2 text-center text-lg">
                            {isCheck ? '✅' : '❌'}
                        </td>

                        <td className="border border-gray-300 p-2">
                            <span className="font-bold text-base block">{item.modelNo}</span>
                            {item.description && <span className="text-gray-500 text-xs">{item.description}</span>}
                        </td>
                        
                        <td className="border border-gray-300 p-2 font-medium text-xs">
                            {colorsDisplay}
                        </td>

                        {/* إجمالي المطلوب بالقطعة */}
                        <td className="border border-gray-300 p-2 text-center text-gray-600">
                            {item.totalQtyPieces}
                        </td>

                        {/* العمود الرئيسي المتغير */}
                        <td className={`border border-gray-300 p-2 text-center font-bold text-lg ${isCheck ? 'bg-gray-50 print:bg-gray-100' : ''}`}>
                            {displayQty > 0 ? displayQty : '-'}
                        </td>

                        {/* المتبقي */}
                        <td className="border border-gray-300 p-2 text-center text-gray-400">
                            {item.totalRemaining > 0 ? item.totalRemaining : '0'}
                        </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-between items-center border-t border-black pt-4 mt-4">
                <div>
                   {printMode === 'batch' ? (
                       <p>إجمالي المصروف في هذه الدفعة: <span className="font-bold">{selectedOrder.itemsAllocatedNow} قطعة</span></p>
                   ) : (
                       <p>إجمالي ما تم تنفيذه سابقاً: <span className="font-bold text-purple-700">{selectedOrder.itemDetails.reduce((a,b)=>a+b.alreadyFulfilled, 0)} قطعة</span></p>
                   )}
                </div>
                <div className="text-left text-sm space-y-8 mt-4">
                   <p>توقيع المستلم: .......................................</p>
                   <p>توقيع أمين المخزن: .......................................</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}