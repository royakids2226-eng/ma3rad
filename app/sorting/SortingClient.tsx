'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { executeOrderBatch } from './actions';

// تعريف الأنواع
type LogItem = {
    batchId: string;
    quantity: number;
    createdAt: Date;
};

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
  qtyAllocatedPieces: number;
  isFullyReady: boolean;
  price: number;
  logs: LogItem[]; // سجلات الصرف
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
  const [showCompleted, setShowCompleted] = useState(false); // تبديل بين الجاري والمنتهي
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);
  
  // أوضاع العرض: 'current_batch' | 'full_history' | 'specific_batch'
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'specific'>('current');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(''); // الباتش المختار من القائمة

  const [isPending, startTransition] = useTransition();

  // 1. الفلترة
  const filteredOrders = useMemo(() => {
    let result = initialOrders;

    // فلترة حسب الحالة (منتهي / جاري)
    result = result.filter(o => showCompleted ? o.isCompletelyDone : !o.isCompletelyDone);

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(lowerTerm) ||
          o.orderNo.toString().includes(lowerTerm)
      );
    }
    return result;
  }, [initialOrders, searchTerm, showCompleted]);


  // 2. استخراج قائمة الباتشات السابقة للأوردر المختار
  const pastBatches = useMemo(() => {
      if (!selectedOrder) return [];
      
      const batchesMap = new Map<string, Date>();
      selectedOrder.itemDetails.forEach(item => {
          item.logs.forEach(log => {
              if (!batchesMap.has(log.batchId)) {
                  batchesMap.set(log.batchId, new Date(log.createdAt));
              }
          });
      });

      // تحويلها لمصفوفة وترتيبها الأحدث أولاً
      return Array.from(batchesMap.entries()).map(([id, date]) => ({
          id,
          date
      })).sort((a, b) => b.date.getTime() - a.date.getTime());

  }, [selectedOrder]);


  // 3. تجميع الأصناف حسب وضع العرض
  const invoiceItems = useMemo(() => {
    if (!selectedOrder) return [];

    const groups: { [key: string]: any } = {};

    selectedOrder.itemDetails.forEach((item) => {
      // تحديد الكمية المراد عرضها بناءً على الوضع المختار
      let quantityToShow = 0;
      let colorsToShow: {[key:string]: number} = {};

      if (viewMode === 'current') {
          // عرض ما هو متاح للصرف الآن (Allocated)
          quantityToShow = item.qtyAllocatedPieces;
          if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;

      } else if (viewMode === 'history') {
          // عرض إجمالي ما تم تنفيذه سابقاً
          quantityToShow = item.alreadyFulfilled;
           if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;

      } else if (viewMode === 'specific' && selectedBatchId) {
          // عرض كمية الباتش المحدد فقط
          const batchLog = item.logs.find(log => log.batchId === selectedBatchId);
          quantityToShow = batchLog ? batchLog.quantity : 0;
          if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;
      }

      // التجميع
      if (!groups[item.modelNo]) {
        groups[item.modelNo] = {
          ...item,
          displayQty: quantityToShow,
          colorsCount: colorsToShow,
          
          totalQtyPieces: item.totalQtyPieces,
          totalRemaining: item.remainingNeeded,
        };
      } else {
        groups[item.modelNo].totalQtyPieces += item.totalQtyPieces;
        groups[item.modelNo].totalRemaining += item.remainingNeeded;
        groups[item.modelNo].displayQty += quantityToShow;

        if (quantityToShow > 0) {
            groups[item.modelNo].colorsCount[item.color] = (groups[item.modelNo].colorsCount[item.color] || 0) + quantityToShow;
        }
      }
    });

    return Object.values(groups).map((group: any) => {
        const colorsStr = Object.entries(group.colorsCount)
          .map(([color, qty]) => `${color} (${qty})`)
          .join(' + ');

        return {
            ...group,
            colorsDisplay: colorsStr === '' ? '-' : colorsStr,
            isCheck: group.displayQty > 0 // علامة الصح إذا كان هناك كمية في هذا العرض
        };
    });
  }, [selectedOrder, viewMode, selectedBatchId]);


  const handleExecuteAndPrint = async () => {
    if (!selectedOrder) return;
    
    // إذا لم نكن في وضع "صرف جديد"، زر الطباعة يفتح نافذة الطباعة فقط
    if (viewMode !== 'current') {
        window.print();
        return;
    }

    if (!confirm('هل أنت متأكد من تنفيذ الكميات المتاحة وحفظها؟')) return;

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
            // بعد الحفظ بنجاح، ننتقل تلقائياً لعرض الباتش الأخير (الذي تم إنشاؤه للتو) نظرياً
            // لكن هنا للتبسيط سنقوم بالطباعة ثم إغلاق المودال تلقائياً عبر التحديث
            setTimeout(() => window.print(), 500);
        } else {
            alert('حدث خطأ أثناء الحفظ.');
        }
    });
  };

  const openModal = (order: OrderType) => {
    setSelectedOrder(order);
    // إذا كان الأوردر منتهي، نفتح مباشرة على التاريخ
    if (order.isCompletelyDone) {
        setViewMode('history');
    } else {
        setViewMode('current');
    }
    setSelectedBatchId('');
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="print:hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📦 سجلات الفرز والتنفيذ</h1>
            <p className="text-slate-500 mt-1">متابعة صرف الأوردرات وطباعة الباتشات السابقة.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors h-10 flex items-center">
              الرئيسية
            </Link>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-slate-100 space-y-4">
           {/* Tabs */}
           <div className="flex gap-2 border-b border-gray-100 pb-2">
              <button 
                onClick={() => setShowCompleted(false)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${!showCompleted ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                 ⏳ قيد التنفيذ
              </button>
              <button 
                onClick={() => setShowCompleted(true)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${showCompleted ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                 ✅ تم الانتهاء (الأرشيف)
              </button>
           </div>

           <div className="flex flex-col md:flex-row gap-4">
                <input 
                    type="text" 
                    placeholder="ابحث باسم العميل أو رقم الأوردر..." 
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
           </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
             let statusColor = "bg-red-500";
             let statusText = "text-red-600";
             
             if (order.isCompletelyDone) {
                statusColor = "bg-green-600";
                statusText = "text-green-700";
             } else if (order.readinessPercentage > 0) {
                statusColor = "bg-amber-500";
                statusText = "text-amber-600";
             }

            return (
              <div key={order.id} className={`bg-white rounded-lg shadow-sm p-5 border relative group ${order.isCompletelyDone ? 'border-green-200 bg-green-50' : 'border-slate-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{order.customer.name}</h2>
                    <span className="text-sm text-slate-500">#{order.orderNo}</span>
                  </div>
                  <div className={`text-xl font-bold ${statusText}`}>
                    {order.isCompletelyDone ? 'مكتمل ✅' : `${order.readinessPercentage}%`}
                  </div>
                </div>

                {!order.isCompletelyDone && (
                    <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                        <div className={`${statusColor} h-4 rounded-full`} style={{ width: `${order.readinessPercentage}%` }}></div>
                    </div>
                )}

                <div className="flex justify-between items-center text-sm text-slate-600 mb-4">
                   {order.isCompletelyDone ? (
                       <span>تم تسليم كافة البنود</span>
                   ) : (
                       <span>متبقي: {order.itemsPendingTotal} / متاح الآن: {order.itemsAllocatedNow}</span>
                   )}
                </div>

                <button 
                  onClick={() => openModal(order)}
                  className={`w-full py-2 text-white rounded-lg transition-colors font-bold flex justify-center items-center gap-2 ${order.isCompletelyDone ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                >
                  {order.isCompletelyDone ? '📄 مراجعة الأرشيف' : '📄 تنفيذ / طباعة'}
                </button>
              </div>
            );
          })}
          {filteredOrders.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
                لا توجد أوردرات في هذه القائمة.
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
                  <h2 className="text-xl font-bold">
                      {selectedOrder.isCompletelyDone ? 'أرشيف التسليمات' : 'إدارة الصرف'}
                  </h2>
                  <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-red-500 text-2xl font-bold">&times;</button>
              </div>
              
              {/* خيارات العرض */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                
                {/* 1. الصرف الحالي */}
                <button 
                    onClick={() => { setViewMode('current'); setSelectedBatchId(''); }}
                    disabled={selectedOrder.isCompletelyDone}
                    className={`p-3 rounded-lg border text-sm font-bold flex flex-col items-center gap-1
                        ${viewMode === 'current' ? 'bg-white border-blue-500 text-blue-600 shadow-md ring-1 ring-blue-500' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-white'}
                        ${selectedOrder.isCompletelyDone ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <span>⚡ دفعة جديدة (متاحة الآن)</span>
                </button>

                {/* 2. باتش سابق محدد */}
                <div className={`p-3 rounded-lg border flex flex-col gap-2 ${viewMode === 'specific' ? 'bg-white border-purple-500 shadow-md ring-1 ring-purple-500' : 'bg-gray-100 border-transparent'}`}>
                    <label className={`text-sm font-bold text-center ${viewMode === 'specific' ? 'text-purple-600' : 'text-gray-500'}`}>📅 باتش سابق (أرشيف)</label>
                    <select 
                        className="w-full p-1 text-sm border rounded"
                        value={selectedBatchId}
                        onChange={(e) => { 
                            setSelectedBatchId(e.target.value); 
                            setViewMode(e.target.value ? 'specific' : viewMode);
                        }}
                    >
                        <option value="">-- اختر تاريخ الصرف --</option>
                        {pastBatches.map(batch => (
                            <option key={batch.id} value={batch.id}>
                                {new Date(batch.date).toLocaleString('ar-EG')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. الإجمالي */}
                <button 
                    onClick={() => { setViewMode('history'); setSelectedBatchId(''); }}
                    className={`p-3 rounded-lg border text-sm font-bold flex flex-col items-center gap-1
                        ${viewMode === 'history' ? 'bg-white border-gray-600 text-gray-800 shadow-md ring-1 ring-gray-600' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-white'}
                    `}
                >
                    <span>∑ إجمالي كل ما تم صرفه</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button 
                    onClick={handleExecuteAndPrint} 
                    disabled={isPending || (viewMode === 'current' && selectedOrder.itemsAllocatedNow === 0)}
                    className={`px-6 py-2 rounded text-white flex items-center gap-2 font-bold shadow-md
                        ${isPending || (viewMode === 'current' && selectedOrder.itemsAllocatedNow === 0) 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : viewMode === 'current' ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-800 hover:bg-slate-900'
                        }`}
                >
                    {isPending ? 'جاري الحفظ...' : (viewMode === 'current' ? '💾 حفظ وطباعة الدفعة' : '🖨️ طباعة السجل المعروض')}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200">إغلاق</button>
              </div>
            </div>

            {/* ورقة الطباعة */}
            <div className="print:block" dir="rtl">
              <div className="text-center mb-8 border-b border-black pb-4">
                 <h1 className="text-3xl font-bold mb-2">
                    {viewMode === 'current' ? 'إذن صرف بضاعة' : (viewMode === 'specific' ? 'نسخة طبق الأصل (باتش سابق)' : 'تقرير إجمالي المسحوبات')}
                 </h1>
                 <p className="text-gray-600">
                     تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}
                     {viewMode === 'specific' && selectedBatchId && (
                         <span className="block text-sm font-bold mt-1">
                             (تاريخ تنفيذ الباتش: {pastBatches.find(b => b.id === selectedBatchId)?.date.toLocaleString('ar-EG')})
                         </span>
                     )}
                 </p>
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
              </div>

              {/* الجدول */}
              <table className="w-full border-collapse border border-gray-300 mb-8">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-sm">
                    <th className="border border-gray-300 p-2 w-10">م</th>
                    <th className="border border-gray-300 p-2 w-10">حالة</th>
                    <th className="border border-gray-300 p-2 text-right">الموديل</th>
                    <th className="border border-gray-300 p-2 text-right">الألوان</th>
                    <th className="border border-gray-300 p-2 text-center w-20">المطلوب</th>
                    <th className="border border-gray-300 p-2 text-center w-24 bg-gray-200 print:bg-gray-300 font-bold">الكمية</th>
                    <th className="border border-gray-300 p-2 text-center w-20 text-gray-500">متبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, index: number) => (
                    <tr key={index} className="text-sm">
                        <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                        <td className="border border-gray-300 p-2 text-center text-lg">
                            {item.isCheck ? '✅' : '❌'}
                        </td>
                        <td className="border border-gray-300 p-2">
                            <span className="font-bold text-base block">{item.modelNo}</span>
                            {item.description && <span className="text-gray-500 text-xs">{item.description}</span>}
                        </td>
                        <td className="border border-gray-300 p-2 font-medium text-xs">
                            {item.colorsDisplay}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-600">
                            {item.totalQtyPieces}
                        </td>
                        <td className={`border border-gray-300 p-2 text-center font-bold text-lg ${item.isCheck ? 'bg-gray-50 print:bg-gray-100' : ''}`}>
                            {item.displayQty > 0 ? item.displayQty : '-'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">
                            {item.totalRemaining > 0 ? item.totalRemaining : '0'}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center border-t border-black pt-4 mt-4">
                <div>
                   <p className="font-bold text-lg">الإجمالي: {invoiceItems.reduce((acc:number, cur:any) => acc + cur.displayQty, 0)} قطعة</p>
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