'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { processSortingBatchDirectly, undoLastBatchByOrder, bulkPostponeItems, bulkReactivateItems } from '@/app/sorting/actions';
import * as XLSX from 'xlsx';

// --- التعريفات البرمجية ---
type LogItem = { batchId: string; quantity: number; createdAt: Date; };
type ItemDetail = {
    id: string; orderItemId: string; modelNo: string; material?: string | null; color: string;
    totalQtyPieces: number; alreadyFulfilled: number; remainingNeeded: number;
    qtyAllocatedPieces: number; isFullyReady: boolean; price: number; logs: LogItem[]; isPostponed: boolean;
};
type OrderType = {
    id: string; orderNo: number; orderSpecificDeposit: number; orderTotalAmount: number; orderRemainingBalance: number;
    customer: { name: string; phone?: string | null; phone2?: string | null; address?: string | null; historicalDepositsText: string; };
    createdAt: Date; readinessPercentage: number; itemsAllocatedNow: number; itemsPendingTotal: number;
    isCompletelyDone: boolean; totalFulfilledOverall: number; itemDetails: ItemDetail[];
};

export default function SortingCutClient({ initialOrders }: { initialOrders: OrderType[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date-desc');
    const [viewTab, setViewTab] = useState<'PENDING' | 'ARCHIVE' | 'POSTPONED'>('PENDING');
    const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    // 1. فلترة وترتيب الأوردرات (نفس منطق الفرز العام)
    const filteredOrders = useMemo(() => {
        let result = initialOrders.filter(o => {
            const matchesSearch = o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.orderNo.toString().includes(searchTerm);
            if (!matchesSearch) return false;
            if (viewTab === 'POSTPONED') return o.itemDetails.some(i => i.isPostponed);
            if (viewTab === 'ARCHIVE') return o.totalFulfilledOverall > 0;
            return !o.isCompletelyDone && !o.itemDetails.every(i => i.isPostponed);
        });

        result.sort((a, b) => {
            if (sortBy === 'ready-desc') return b.readinessPercentage - a.readinessPercentage;
            if (sortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return result;
    }, [initialOrders, searchTerm, viewTab, sortBy]);

    // 2. تجميع الأصناف داخل الفاتورة (دمج الألوان مع إظهار المتاح والمؤجل)
    const invoiceItems = useMemo(() => {
        if (!selectedOrder) return [];
        const groups: { [key: string]: any } = {};
        selectedOrder.itemDetails.forEach((item) => {
            if (!groups[item.modelNo]) {
                groups[item.modelNo] = { ...item, displayQty: item.qtyAllocatedPieces, variantIds: [item.orderItemId], colorsMap: { [item.color]: item.qtyAllocatedPieces } };
            } else {
                groups[item.modelNo].displayQty += item.qtyAllocatedPieces;
                groups[item.modelNo].variantIds.push(item.orderItemId);
                if (item.qtyAllocatedPieces > 0) groups[item.modelNo].colorsMap[item.color] = (groups[item.modelNo].colorsMap[item.color] || 0) + item.qtyAllocatedPieces;
            }
        });
        return Object.values(groups).map((g: any) => ({
            ...g,
            colorsDisplay: Object.entries(g.colorsMap).map(([c, q]) => `${c} (${q})`).join(' + '),
            isCheck: g.displayQty > 0
        })).filter(i => (viewTab === 'POSTPONED' ? i.isPostponed : (viewTab === 'ARCHIVE' ? i.displayQty > 0 : !i.isPostponed)));
    }, [selectedOrder, viewTab]);

    return (
        <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
            <div className="print:hidden">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-black text-indigo-900">✂️ فرز بالقص (دقيق بالخامة)</h1>
                    <Link href="/" className="bg-white border px-4 py-2 rounded-xl shadow-sm font-bold text-gray-600">الرئيسية</Link>
                </div>

                {/* التحكم والتبويبات */}
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-8 border border-slate-100 space-y-4">
                    <div className="flex gap-2 border-b border-gray-100 pb-2">
                        <button onClick={() => setViewTab('PENDING')} className={`px-8 py-2.5 rounded-xl font-black transition-all ${viewTab === 'PENDING' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>⏳ قيد التنفيذ</button>
                        <button onClick={() => setViewTab('POSTPONED')} className={`px-8 py-2.5 rounded-xl font-black transition-all ${viewTab === 'POSTPONED' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>📦 المؤجل</button>
                        <button onClick={() => setViewTab('ARCHIVE')} className={`px-8 py-2.5 rounded-xl font-black transition-all ${viewTab === 'ARCHIVE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>✅ الأرشيف</button>
                    </div>
                    <div className="flex gap-4">
                        <input type="text" placeholder="بحث باسم العميل أو رقم الأوردر..." className="flex-1 px-4 py-3 border rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {/* كروت الأوردرات (الشكل المطلوب) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOrders.map(order => {
                        const statusColor = order.isCompletelyDone ? "text-green-600" : order.readinessPercentage > 0 ? "text-amber-600" : "text-red-600";
                        return (
                            <div key={order.id} className="bg-white rounded-[2rem] shadow-sm p-6 border border-slate-100 relative group hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h2 className="text-xl font-black text-slate-800 leading-tight mb-1">{order.customer.name}</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">#{order.orderNo}</span>
                                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-black border border-amber-200">
                                                💰 عربون: {order.customer.historicalDepositsText}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`text-2xl font-black ${statusColor}`}>{order.isCompletelyDone ? 'مكتمل ✅' : `${order.readinessPercentage}%`}</div>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden shadow-inner">
                                    <div className={`h-full transition-all duration-1000 ${order.isCompletelyDone ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${order.readinessPercentage}%` }}></div>
                                </div>
                                <button onClick={() => setSelectedOrder(order)} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all">📄 تنفيذ / مراجعة</button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* المودال الشامل (الطباعة والتأجيل المالي) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-4 print:static print:p-0">
                    <div className="bg-white w-full max-w-5xl rounded-[2.5rem] p-10 shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:m-0">
                        {/* الهيدر العلوي */}
                        <div className="flex justify-between items-center mb-8 print:hidden">
                            <div className="flex gap-2">
                                {selectedRows.length > 0 && viewTab === 'PENDING' && (
                                    <button onClick={async () => {
                                        const count = invoiceItems.filter(item => item.variantIds.some((id: string) => selectedRows.includes(id))).length;
                                        if(confirm(`تأجيل ${count} موديل؟`)) { await bulkPostponeItems(selectedRows); setSelectedRows([]); }
                                    }} className="bg-orange-600 text-white px-6 py-2 rounded-xl font-black animate-bounce shadow-xl">📦 تأجيل المختارة ({invoiceItems.filter(item => item.variantIds.some((id: string) => selectedRows.includes(id))).length})</button>
                                )}
                                {selectedRows.length > 0 && viewTab === 'POSTPONED' && (
                                    <button onClick={async () => {
                                        const count = invoiceItems.filter(item => item.variantIds.some((id: string) => selectedRows.includes(id))).length;
                                        if(confirm(`إعادة ${count} موديل للفرز؟`)) { await bulkReactivateItems(selectedRows); setSelectedRows([]); }
                                    }} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black animate-pulse shadow-xl">🚀 إعادة للفرز ({invoiceItems.filter(item => item.variantIds.some((id: string) => selectedRows.includes(id))).length})</button>
                                )}
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-red-500 text-3xl font-bold">✕</button>
                        </div>

                        {/* بيانات العميل في الطباعة */}
                        <div className="grid grid-cols-2 gap-8 mb-10 border-b pb-8">
                            <div className="space-y-2">
                                <p className="font-black text-2xl text-slate-900">{selectedOrder.customer.name}</p>
                                <p className="text-sm font-bold text-slate-600 flex gap-4"><span>📱 {selectedOrder.customer.phone}</span> {selectedOrder.customer.phone2 && <span> / {selectedOrder.customer.phone2}</span>}</p>
                                {selectedOrder.customer.address && <p className="text-sm text-gray-500">📍 {selectedOrder.customer.address}</p>}
                            </div>
                            <div className="text-left"><p className="font-black text-5xl text-blue-600">#{selectedOrder.orderNo}</p><p className="text-xs text-gray-400 mt-2">تاريخ الأوردر: {new Date(selectedOrder.createdAt).toLocaleDateString('ar-EG')}</p></div>
                        </div>

                        {/* جدول الأصناف (مع الخامة) */}
                        <table className="w-full border-collapse mb-10">
                            <thead>
                                <tr className="bg-slate-100 border-b-2 border-slate-200 text-sm">
                                    <th className="p-3 w-10 print:hidden"><input type="checkbox" onChange={(e) => setSelectedRows(e.target.checked ? invoiceItems.flatMap(i => i.variantIds) : [])} /></th>
                                    <th className="p-3 w-10">م</th>
                                    <th className="p-3 text-right">الموديل (الخامة)</th>
                                    <th className="p-3 text-right">الألوان</th>
                                    <th className="p-3 text-center">المطلوب</th>
                                    <th className="p-3 text-center bg-indigo-50 font-black text-indigo-700">المتاح</th>
                                    <th className="p-3 text-center">السعر</th>
                                    <th className="p-3 text-center">إجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceItems.map((item: any, index: number) => (
                                    <tr key={index} className="border-b text-sm">
                                        <td className="p-3 text-center print:hidden"><input type="checkbox" checked={item.variantIds.every((id:string) => selectedRows.includes(id))} onChange={() => setSelectedRows(prev => prev.includes(item.variantIds[0]) ? prev.filter(id => !item.variantIds.includes(id)) : [...prev, ...item.variantIds])} /></td>
                                        <td className="p-3 text-center font-bold text-slate-300">{index + 1}</td>
                                        <td className="p-3">
                                            <div className="font-black text-lg text-slate-800">{item.modelNo}</div>
                                            <div className="text-[10px] font-bold text-indigo-500 uppercase">{item.material || 'بدون كود خامة'}</div>
                                        </td>
                                        <td className="p-3 text-xs font-medium text-slate-500">{item.colorsDisplay}</td>
                                        <td className="p-3 text-center font-bold text-slate-400">{item.totalQtyPieces}</td>
                                        <td className="p-3 text-center font-black text-xl text-indigo-900 bg-indigo-50/30">{item.displayQty || '-'}</td>
                                        <td className="p-3 text-center font-mono">{item.price.toFixed(2)}</td>
                                        <td className="p-3 text-center font-black">{(item.displayQty * item.price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* الفوتر المالي الموحد */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-t-2 border-slate-100 pt-8">
                            <div className="text-slate-400 text-sm italic font-bold space-y-8 mt-4 print:block hidden">
                                <p>توقيع المستلم: .......................................</p>
                                <p>توقيع أمين المخزن: .......................................</p>
                            </div>
                            <div className="w-80 space-y-3 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <div className="flex justify-between"><span>إجمالي هذه الدفعة:</span><span className="font-black text-xl">{(invoiceItems.reduce((acc:number, cur:any) => acc + (cur.displayQty * cur.price), 0)).toFixed(2)} ج.م</span></div>
                                <div className="flex justify-between pt-2 border-t border-dashed"><span>إجمالي الفاتورة:</span><span className="font-bold">{selectedOrder.orderTotalAmount.toFixed(2)} ج.م</span></div>
                                <div className="flex justify-between text-blue-600 font-bold"><span>عربون الفاتورة (-):</span><span>{selectedOrder.orderSpecificDeposit.toFixed(2)} ج.م</span></div>
                                <div className="flex justify-between text-2xl font-black border-t-2 border-slate-900 pt-2 text-indigo-900"><span>المتبقي للتحصيل:</span><span>{selectedOrder.orderRemainingBalance.toFixed(2)} ج.م</span></div>
                            </div>
                        </div>
                        
                        <div className="mt-8 flex justify-end gap-2 print:hidden">
                            <button onClick={() => window.print()} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">🖨️ طباعة الإذن</button>
                            <button onClick={async () => {
                                const items = selectedOrder.itemDetails.filter(i => i.qtyAllocatedPieces > 0).map(i => ({ orderItemId: i.orderItemId, qtyToFulfill: i.qtyAllocatedPieces }));
                                if (items.length > 0) { await processSortingBatchDirectly(selectedOrder.id, items); window.print(); setSelectedOrder(null); }
                            }} className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">🚀 تنفيذ ومعالجة فورية</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
