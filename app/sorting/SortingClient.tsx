'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { processSortingBatchDirectly, undoOrderBatch, undoLastBatchByOrder } from './actions';
import * as XLSX from 'xlsx';

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
  logs: LogItem[];
};

type OrderType = {
  id: string;
  orderNo: number;
  orderSpecificDeposit: number; 
  orderTotalAmount: number;     
  orderRemainingBalance: number; 
  customer: { 
    name: string; 
    phone?: string | null; 
    phone2?: string | null; 
    address?: string | null; 
    historicalDepositsText: string; 
  };
  createdAt: Date;
  readinessPercentage: number;
  itemsAllocatedNow: number;
  itemsPendingTotal: number;
  isCompletelyDone: boolean;
  totalFulfilledOverall: number;
  itemDetails: ItemDetail[];
};

export default function SortingClient({ initialOrders }: { initialOrders: OrderType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'history' | 'specific'>('current');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [archiveViewType, setArchiveViewType] = useState<'executed_only' | 'full_statement'>('executed_only');
  const [isPending, startTransition] = useTransition();
  const [isUndoPending, startUndoTransition] = useTransition();
  const [isQuickUndoPending, startQuickUndoTransition] = useTransition();

  const handleQuickUndo = async (orderId: string) => {
      if (!confirm('هل أنت متأكد من التراجع عن آخر عملية صرف؟ سيعود الأوردر لقائمة "قيد التنفيذ".')) return;

      startQuickUndoTransition(async () => {
          const result = await undoLastBatchByOrder(orderId);
          if (result.success) {
              alert('تم التراجع بنجاح وعاد الأوردر لقيد التنفيذ.');
          } else {
              alert(`خطأ: ${result.error}`);
          }
      });
  };

    const handleExportLastBatchExcel = (order: OrderType) => {
        const allLogs = order.itemDetails.flatMap(item => 
            item.logs.map(log => ({ ...log, modelNo: item.modelNo }))
        );

        if (allLogs.length === 0) return alert("لا توجد سجلات صرف لهذا الأوردر");

        const latestLog = allLogs.reduce((prev, current) => 
            (new Date(prev.createdAt) > new Date(current.createdAt)) ? prev : current
        );
        const latestBatchId = latestLog.batchId;

        const lastBatchData = allLogs
            .filter(log => log.batchId === latestBatchId)
            .reduce((acc: any[], log) => {
                const existing = acc.find(x => x.barcode === log.modelNo);
                if (existing) {
                    existing.qty += log.quantity;
                } else {
                    acc.push({
                        barcode: log.modelNo,
                        qty: log.quantity
                    });
                }
                return acc;
            }, []);

        const ws = XLSX.utils.json_to_sheet(lastBatchData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        
        XLSX.writeFile(wb, `${order.customer.name}_اخر_دفعة.xlsx`);
    };

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...initialOrders];

    if (showCompleted) {
        result = result.filter(o => o.totalFulfilledOverall > 0);
    } else {
        result = result.filter(o => !o.isCompletelyDone);
    }

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
  }, [initialOrders, searchTerm, showCompleted, sortBy]);

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

      return Array.from(batchesMap.entries()).map(([id, date]) => ({
          id,
          date
      })).sort((a, b) => b.date.getTime() - a.date.getTime());

  }, [selectedOrder]);

  const invoiceItems = useMemo(() => {
    if (!selectedOrder) return [];

    const groups: { [key: string]: any } = {};

    selectedOrder.itemDetails.forEach((item) => {
        let quantityToShow = 0;
        let colorsToShow: {[key:string]: number} = {};

        if (viewMode === 'current') {
            quantityToShow = item.qtyAllocatedPieces;
            if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;
        } else if (viewMode === 'history') {
            quantityToShow = item.alreadyFulfilled;
            if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;
        } else if (viewMode === 'specific' && selectedBatchId) {
            const batchLog = item.logs.find(log => log.batchId === selectedBatchId);
            quantityToShow = batchLog ? batchLog.quantity : 0;
            if (quantityToShow > 0) colorsToShow[item.color] = quantityToShow;
        }

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

    return Object.values(groups)
        .map((group: any) => {
            const colorsStr = Object.entries(group.colorsCount)
              .map(([color, qty]) => `${color} (${qty})`)
              .join(' + ');

            return {
                ...group,
                colorsDisplay: colorsStr === '' ? '-' : colorsStr,
                isCheck: group.displayQty > 0 
            };
        })
        .filter(item => {
            if (viewMode === 'history') {
                return archiveViewType === 'executed_only' ? item.displayQty > 0 : true;
            }
            if (viewMode === 'specific') return item.displayQty > 0;
            return true;
        });
}, [selectedOrder, viewMode, selectedBatchId, archiveViewType]);

   const handleExportToExcel = (order: OrderType) => {
    const dataForExcel = order.itemDetails
        .filter(item => item.alreadyFulfilled > 0)
        .reduce((acc: any[], item) => {
            const existing = acc.find(x => x.barcode === item.modelNo);
            if (existing) {
                existing.qty += item.alreadyFulfilled;
            } else {
                acc.push({
                    barcode: item.modelNo,
                    qty: item.alreadyFulfilled
                });
            }
            return acc;
        }, []);

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${order.customer.name}.xlsx`);
};

  const handleQueueAndPrint = async () => {
    if (!selectedOrder) return;

    if (viewMode !== 'current') {
      window.print();
      return;
    }

    const itemsToFulfill = selectedOrder.itemDetails
      .filter(item => item.qtyAllocatedPieces > 0)
      .map(item => ({
        orderItemId: item.orderItemId,
        qtyToFulfill: item.qtyAllocatedPieces
      }));

    if (itemsToFulfill.length === 0) {
      alert('لا توجد كميات متاحة للمعالجة حالياً.');
      return;
    }

    if (!confirm('سيتم الآن خصم الكميات المتاحة من المخزن وطباعة الإذن. هل أنت متأكد؟')) return;

    startTransition(async () => {
      const result = await processSortingBatchDirectly(selectedOrder.id, itemsToFulfill);

      if (result.success) {
        setTimeout(() => {
            window.print();
            alert("✅ تمت المعالجة والطباعة بنجاح");
            setSelectedOrder(null);
        }, 500);
      } else {
        alert(`❌ فشل: ${result.error}`);
      }
    });
  };

  const handleUndoBatch = async (batchId: string) => {
    if (!batchId) return;

    if (!confirm('هل أنت متأكد من التراجع عن هذه الدفعة؟ لا يمكن استعادة هذه العملية.')) return;

    startUndoTransition(async () => {
      const result = await undoOrderBatch(batchId);
      if (result.success) {
        alert('تم التراجع عن الدفعة بنجاح.');
        setSelectedOrder(null);
      } else {
        alert(`فشل التراجع: ${result.error}`);
      }
    });
  };

  const openModal = (order: OrderType) => {
    setSelectedOrder(order);
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

        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-slate-100 space-y-4">
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
                
                <select 
                    className="w-full md:w-64 p-2 border border-slate-200 rounded-lg bg-white"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="date-desc">التاريخ: الأحدث أولاً</option>
                    <option value="date-asc">التاريخ: الأقدم أولاً</option>
                    <option value="ready-desc">الجاهزية: الأعلى أولاً</option>
                    <option value="ready-asc">الجاهزية: الأقل أولاً</option>
                </select>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedOrders.map((order) => {
            let statusText = "";
            let statusColor = "";
            let progressBarColor = "bg-red-500";

            if (order.isCompletelyDone) {
                statusText = "مكتمل ✅";
                statusColor = "text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200";
                progressBarColor = "bg-green-500";
            } else if (order.totalFulfilledOverall > 0) {
                statusText = "تنفيذ جزئي ⏳";
                statusColor = "text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200";
                progressBarColor = "bg-amber-500";
            } else {
                statusText = `${order.readinessPercentage}%`;
                statusColor = "text-red-600";
            }

            return (
              <div key={order.id} className={`bg-white rounded-lg shadow-sm p-5 border relative group ${order.isCompletelyDone ? 'border-green-200 bg-green-50' : 'border-slate-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{order.customer.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">#{order.orderNo}</span>
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black border border-amber-200">
                            💰 عربون: {order.customer.historicalDepositsText}
                        </span>
                    </div>
                  </div>
                  <div className={`text-base font-black ${statusColor}`}>
                    {statusText}
                  </div>
                </div>

                {!order.isCompletelyDone && (
                    <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                        <div className={`${progressBarColor} h-4 rounded-full`} style={{ width: `${order.readinessPercentage}%` }}></div>
                    </div>
                )}

                <div className="flex justify-between items-center text-sm text-slate-600 mb-4">
                   {order.isCompletelyDone ? (
                       <span>تم تسليم كافة البنود</span>
                   ) : (
                       <span>متبقي: {order.itemsPendingTotal} / متاح الآن: {order.itemsAllocatedNow}</span>
                   )}
                </div>

                
                <div className="flex flex-wrap gap-2 mt-4">
                    <button 
                        onClick={() => openModal(order)} 
                        className={`flex-1 py-2 text-white rounded-lg font-bold transition-colors ${order.isCompletelyDone ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        📄 {order.isCompletelyDone ? 'الأرشيف' : 'متابعة الصرف'}
                    </button>

                    {order.totalFulfilledOverall > 0 && (
                        <>
                            <button 
                                onClick={() => handleQuickUndo(order.id)}
                                disabled={isQuickUndoPending}
                                className="px-3 py-2 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 font-bold shadow-sm"
                                title="تراجع عن آخر دفعة صرف"
                            >
                                {isQuickUndoPending ? '...' : '🔄 تراجع'}
                            </button>

                            <button 
                                onClick={() => handleExportLastBatchExcel(order)}
                                className="px-3 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-200 font-bold shadow-sm"
                                title="تحميل إكسيل لآخر دفعة فقط"
                            >
                                📊 آخر دفعة
                            </button>
                            
                            <button 
                                onClick={() => handleExportToExcel(order)}
                                className="px-3 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-200 font-bold shadow-sm"
                                title="تحميل إكسيل لكل المنصرف"
                            >
                                📁 إجمالي
                            </button>
                        </>
                    )}
                </div>
              </div>
            );
          })}
          {filteredAndSortedOrders.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
                لا توجد أوردرات تطابق البحث.
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto bg-black bg-opacity-50 print:static print:overflow-visible print:bg-white print:p-0">
          <div className="bg-white w-full max-w-4xl m-4 p-8 rounded-xl shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:m-0 print:rounded-none">
            
            <div className="flex flex-col gap-4 mb-8 print:hidden border-b pb-4">
                 <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                      {selectedOrder.isCompletelyDone ? 'أرشيف التسليمات' : 'إدارة الصرف'}
                  </h2>
                  <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-red-500 text-2xl font-bold">&times;</button>
              </div>
              
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg print:hidden">
                    <button onClick={() => { setViewMode('current'); }} className={`p-2 rounded-lg border text-xs font-bold ${viewMode === 'current' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>
                        ⚡ دفعة جديدة
                    </button>

                    <button onClick={() => { setViewMode('history'); setArchiveViewType('executed_only'); }} className={`p-2 rounded-lg border text-xs font-bold ${viewMode === 'history' && archiveViewType === 'executed_only' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500'}`}>
                        🚚 كشف المنفذ فقط
                    </button>

                    <button onClick={() => { setViewMode('history'); setArchiveViewType('full_statement'); }} className={`p-2 rounded-lg border text-xs font-bold ${viewMode === 'history' && archiveViewType === 'full_statement' ? 'bg-slate-800 text-white' : 'bg-white text-gray-500'}`}>
                        📊 الفاتورة العامة
                    </button>

                    <div className="p-1 border rounded bg-white flex flex-col">
                        <select value={selectedBatchId} onChange={(e) => { setSelectedBatchId(e.target.value); setViewMode('specific'); }} className="text-[10px] outline-none">
                            <option value="">📅 باتش سابق</option>
                            {pastBatches.map(b => <option key={b.id} value={b.id}>{new Date(b.date).toLocaleDateString()}</option>)}
                        </select>
                    </div>
                </div>

              <div className="flex justify-between items-center gap-2 mt-4">
                 {viewMode === 'specific' && selectedBatchId && (
                    <button
                        onClick={() => handleUndoBatch(selectedBatchId)}
                        disabled={isUndoPending}
                        className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 font-bold shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isUndoPending ? 'جاري التراجع...' : '🗑️ تراجع عن تنفيذ الباتش'}
                    </button>
                )}
                <div className="flex-grow flex justify-end gap-2">
                     <button 
                        onClick={handleQueueAndPrint} 
                        disabled={isPending || (viewMode === 'current' && selectedOrder.itemsAllocatedNow === 0)}
                        className={`px-6 py-2 rounded text-white flex items-center gap-2 font-bold shadow-md
                            ${isPending || (viewMode === 'current' && selectedOrder.itemsAllocatedNow === 0) 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : viewMode === 'current' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'
                            }`}
                    >
                        {isPending ? '⏳ جاري المعالجة...' : (viewMode === 'current' ? '🚀 تنفيذ وطباعة فورية' : '🖨️ طباعة السجل المعروض')}
                    </button>
                    <button onClick={() => setSelectedOrder(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">إغلاق</button>
                </div>
              </div>
            </div>

            <div className="print:block" dir="rtl">
              <div className="text-center mb-8 border-b border-black pb-4">
                <h1 className="text-3xl font-bold mb-2 text-center">
                    {viewMode === 'current' ? 'إذن صرف بضاعة' : 
                    viewMode === 'history' ? (archiveViewType === 'executed_only' ? 'كشف بضاعة منفذة' : 'كشف حساب أوردر (عام)') : 
                    'نسخة طبق الأصل (باتش سابق)'}
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
    <div className="space-y-1">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">بيانات العميل</p>
        <p className="font-black text-xl text-slate-900">{selectedOrder.customer.name}</p>
        
        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span>📱 {selectedOrder.customer.phone}</span>
            {selectedOrder.customer.phone2 && (
                <span className="border-r border-gray-300 pr-2"> / {selectedOrder.customer.phone2}</span>
            )}
        </p>
        
        {selectedOrder.customer.address && (
            <p className="text-sm text-gray-600 flex items-start gap-1">
                <span className="shrink-0">📍</span>
                <span>{selectedOrder.customer.address}</span>
            </p>
        )}
    </div>
    
    <div className="text-left flex flex-col justify-center">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">رقم الأوردر</p>
        <p className="font-black text-4xl text-blue-600">#{selectedOrder.orderNo}</p>
        <p className="text-[10px] text-gray-400 mt-1">تاريخ الأوردر: {new Date(selectedOrder.createdAt).toLocaleDateString('ar-EG')}</p>
    </div>
</div>

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
                    <th className="border border-gray-300 p-2 text-center w-20">السعر</th>
                    <th className="border border-gray-300 p-2 text-center w-24">إجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, index: number) => (
                    <tr key={index} className="text-sm print:break-inside-avoid">
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
                        <td className="border border-gray-300 p-2 text-center font-mono">{item.price.toFixed(2)}</td>
                        <td className="border border-gray-300 p-2 text-center font-bold">
                            {item.displayQty > 0 ? (item.displayQty * item.price).toFixed(2) : '-'}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-8 border-t-2 border-black pt-4">
                  <div className="flex justify-between items-start">
                      <div className="text-right text-sm font-bold space-y-6">
                         <p>توقيع المستلم: .......................................</p>
                         <p>توقيع أمين المخزن: .......................................</p>
                      </div>

                      <div className="w-64 border border-black p-3 rounded-lg space-y-2">
                          <div className="flex justify-between text-sm">
                              <span>إجمالي هذه الدفعة:</span>
                              <span className="font-bold">
                                  {(invoiceItems.reduce((acc:number, cur:any) => acc + (cur.displayQty * cur.price), 0) || 0).toFixed(2)} ج.م
                              </span>
                          </div>
                          <div className="flex justify-between text-sm border-t border-dashed pt-1">
                              <span>إجمالي الفاتورة الكلي:</span>
                              <span>{(selectedOrder?.orderTotalAmount || 0).toFixed(2)} ج.م</span>
                          </div>
                          <div className="flex justify-between text-sm text-blue-700 font-bold">
                              <span>عربون الأوردر الحالي (-):</span>
                              <span>{(selectedOrder?.orderSpecificDeposit || 0).toFixed(2)} ج.م</span>
                          </div>
                          <div className="flex justify-between text-lg font-black border-t-2 border-black pt-1 mt-1">
                              <span>المتبقي من الفاتورة:</span>
                              <span>{(selectedOrder?.orderRemainingBalance || 0).toFixed(2)} ج.م</span>
                          </div>
                      </div>
                  </div>
                  <div className="mt-4 text-[10px] text-gray-400 italic text-center">
                        * الأسعار المعروضة هي أسعار القطعة الواحدة.
                   </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
