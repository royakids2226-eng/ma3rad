'use client';
import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { processSortingBatchDirectly, undoLastBatchByOrder, bulkPostponeItems, bulkReactivateItems } from '@/app/sorting/actions';
import * as XLSX from 'xlsx';

// ... (نفس تعريفات الـ Types من الفرز العام)

export default function SortingCutClient({ initialOrders }: { initialOrders: any[] }) {
    const [viewTab, setViewTab] = useState<'PENDING' | 'ARCHIVE' | 'POSTPONED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    // 1. منطق الفلترة الموحد
    const filteredOrders = useMemo(() => {
        return initialOrders.filter(o => {
            const matchesSearch = o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.orderNo.toString().includes(searchTerm);
            if (!matchesSearch) return false;

            if (viewTab === 'POSTPONED') return o.itemDetails.some((i:any) => i.isPostponed);
            if (viewTab === 'ARCHIVE') return o.totalFulfilledOverall > 0;
            return !o.isCompletelyDone && !o.itemDetails.every((i:any) => i.isPostponed);
        });
    }, [initialOrders, searchTerm, viewTab]);

    // 2. تجميع الأصناف داخل المودال (نفس شكل الصورة 2)
    const invoiceItems = useMemo(() => {
        if (!selectedOrder) return [];
        const groups: { [key: string]: any } = {};
        selectedOrder.itemDetails.forEach((item: any) => {
            if (!groups[item.modelNo]) {
                groups[item.modelNo] = { ...item, displayQty: item.qtyAllocatedPieces, variantIds: [item.orderItemId], colorsMap: { [item.color]: item.qtyAllocatedPieces } };
            } else {
                groups[item.modelNo].displayQty += item.qtyAllocatedPieces;
                groups[item.modelNo].variantIds.push(item.orderItemId);
                groups[item.modelNo].colorsMap[item.color] = (groups[item.modelNo].colorsMap[item.color] || 0) + item.qtyAllocatedPieces;
            }
        });
        return Object.values(groups).map((g: any) => ({
            ...g,
            colorsDisplay: Object.entries(g.colorsMap).map(([c, q]) => `${c} (${q})`).join(' + '),
            isCheck: g.displayQty > 0
        })).filter(i => (viewTab === 'POSTPONED' ? i.isPostponed : (viewTab === 'ARCHIVE' ? i.displayQty > 0 : !i.isPostponed)));
    }, [selectedOrder, viewTab]);

    // ... (دوال handleQueueAndPrint, handleExportToExcel, handleQuickUndo و bulk actions)

    return (
        <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
            <div className="print:hidden">
                <h1 className="text-3xl font-black text-indigo-800 mb-6">✂️ فرز بالقص (دقيق بالخامة)</h1>
                
                {/* التبويبات */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                    <button onClick={() => setViewTab('PENDING')} className={`px-6 py-3 rounded-t-xl font-bold ${viewTab === 'PENDING' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>
                        ⏳ قيد التنفيذ
                    </button>
                    <button onClick={() => setViewTab('POSTPONED')} className={`px-6 py-3 rounded-t-xl font-bold ${viewTab === 'POSTPONED' ? 'bg-orange-600 text-white' : 'bg-white text-gray-500'}`}>
                        📦 المؤجل
                    </button>
                    <button onClick={() => setViewTab('ARCHIVE')} className={`px-6 py-3 rounded-t-xl font-bold ${viewTab === 'ARCHIVE' ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}>
                        ✅ الأرشيف
                    </button>
                </div>

                {/* عرض الكروت (تأكد من وضع الحقول المالية وعربون العميل كما فعلنا في الفرز العام) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredOrders.map(order => (
                        <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                             {/* ... كود كارت الأوردر المكتمل مع العرابين والبيانات ... */}
                             <button onClick={() => setSelectedOrder(order)} className="w-full mt-4 bg-slate-900 text-white py-2 rounded-xl font-bold">📄 تنفيذ / مراجعة</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* المودال الخاص بالطباعة والتأجيل - مطابق تماماً للفرز العام */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto p-4 print:static print:bg-white print:p-0">
                    <div className="bg-white max-w-5xl mx-auto rounded-3xl p-8 shadow-2xl relative print:shadow-none">
                         {/* ... الهيدر، أزرار التأجيل الجماعي، بيانات العميل، الجدول، والفوتر المالي ... */}
                         {/* تأكد من استخدام selectedOrder.orderSpecificDeposit و orderTotalAmount */}
                    </div>
                </div>
            )}
        </div>
    );
}
