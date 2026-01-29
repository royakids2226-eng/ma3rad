'use client'
import { useState, useEffect } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 التقارير المركزية</h1>
        {/* زر الطباعة */}
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-black print:hidden">
            🖨️ طباعة التقرير
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 mb-6 border-b print:hidden">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-6 py-3 font-bold ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            📦 جرد المخزون
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-6 py-3 font-bold ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            💰 دفتر الخزينة
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white p-6 rounded-lg shadow min-h-[500px]">
          {activeTab === 'INVENTORY' && <InventoryReportView />}
          {activeTab === 'SAFE' && <SafeLedgerView />}
      </div>
    </div>
  );
}

// ===============================================
// مكون تقرير المخزون (Inventory Component)
// ===============================================
function InventoryReportView() {
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getInventoryReport().then(res => {
            if(res.success) {
                // 👇 التعديل هنا: إضافة || [] لمنع الخطأ
                setData(res.data || []);
                setSummary(res.summary || {});
            }
            setLoading(false);
        });
    }, []);

    if (loading) return <div>جاري تحميل المخزون...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">تقرير أرصدة الأصناف (الجرد)</h2>
            
            {/* بطاقات الملخص */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded border border-blue-200 text-center">
                    <div className="text-gray-500 text-sm">عدد الموديلات</div>
                    <div className="text-2xl font-bold text-blue-700">{summary.totalItems}</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded border border-indigo-200 text-center">
                    <div className="text-gray-500 text-sm">إجمالي المخزون (دستة)</div>
                    <div className="text-2xl font-bold text-indigo-700">{summary.totalStockDozens}</div>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-200 text-center">
                    <div className="text-gray-500 text-sm">القيمة البيعية التقديرية</div>
                    <div className="text-2xl font-bold text-green-700">{summary.totalValue?.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* الجدول */}
            <table className="w-full text-sm text-right border-collapse">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-3 border">الموديل</th>
                        <th className="p-3 border">اللون</th>
                        <th className="p-3 border">الحالة</th>
                        <th className="p-3 border">الرصيد (دستة)</th>
                        <th className="p-3 border">سعر البيع</th>
                        <th className="p-3 border">القيمة الإجمالية</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item: any) => (
                        <tr key={item.id} className={item.stockQty <= 0 ? 'bg-red-50' : ''}>
                            <td className="p-2 border font-bold">{item.modelNo}</td>
                            <td className="p-2 border">{item.color}</td>
                            <td className="p-2 border text-xs">{item.status === 'OPEN' ? 'مفتوح' : 'مغلق'}</td>
                            <td className={`p-2 border font-bold ${item.stockQty <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{item.stockQty}</td>
                            <td className="p-2 border">{item.price}</td>
                            <td className="p-2 border font-bold">{item.totalValue.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ===============================================
// مكون دفتر الخزينة (Safe Ledger Component)
// ===============================================
function SafeLedgerView() {
    const [safes, setSafes] = useState<any[]>([]);
    const [selectedSafe, setSelectedSafe] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const [ledger, setLedger] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getSafesList().then(data => {
            setSafes(data);
            if(data.length > 0) setSelectedSafe(data[0].id);
        });
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        const res = await getSafeLedger(selectedSafe, startDate, endDate);
        if(res.success) {
            // 👇 التعديل هنا أيضاً للأمان
            setLedger(res.data || []);
            setSummary({ 
                totalIn: res.totalIn || 0, 
                currentBalance: res.currentBalance || 0 
            });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">دفتر أستاذ الخزينة (حركة النقدية)</h2>

            {/* الفلاتر */}
            <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded border print:hidden">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold mb-1">اختر الخزنة</label>
                    <select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-2 border rounded">
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1">من تاريخ</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1">إلى تاريخ</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded" />
                </div>
                <button onClick={handleSearch} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 h-[42px]">
                    عرض التقرير 🔍
                </button>
            </div>

            {/* النتائج */}
            {loading ? <div className="text-center py-10">جاري التحميل...</div> : (
                <>
                    {/* ملخص الحركة */}
                    <div className="flex gap-4 mb-4">
                        <div className="bg-green-100 p-3 rounded border border-green-300 flex-1 text-center">
                            <span className="block text-xs text-green-800">إجمالي الوارد (في الفترة)</span>
                            <span className="block text-xl font-bold text-green-900">{summary.totalIn?.toLocaleString() || 0} ج.م</span>
                        </div>
                        <div className="bg-gray-800 p-3 rounded border border-gray-900 flex-1 text-center text-white">
                            <span className="block text-xs text-gray-400">الرصيد التراكمي الحالي</span>
                            <span className="block text-xl font-bold">{summary.currentBalance?.toLocaleString() || 0} ج.م</span>
                        </div>
                    </div>

                    {/* جدول الحركة */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 border">التاريخ</th>
                                    <th className="p-2 border">نوع الحركة</th>
                                    <th className="p-2 border">البيان / الوصف</th>
                                    <th className="p-2 border">المستلم</th>
                                    <th className="p-2 border bg-green-50 text-green-800">وارد (+)</th>
                                    <th className="p-2 border bg-red-50 text-red-800">صادر (-)</th>
                                    <th className="p-2 border bg-gray-200">الرصيد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.length === 0 ? (
                                    <tr><td colSpan={7} className="p-4 text-center text-gray-500">لا توجد حركات في هذه الفترة</td></tr>
                                ) : (
                                    ledger.map((row: any) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="p-2 border whitespace-nowrap">{new Date(row.date).toLocaleDateString('ar-EG')} <span className="text-xs text-gray-400">{new Date(row.date).toLocaleTimeString('ar-EG')}</span></td>
                                            <td className="p-2 border font-bold text-xs">{row.type}</td>
                                            <td className="p-2 border">{row.description}</td>
                                            <td className="p-2 border text-xs">{row.user}</td>
                                            <td className="p-2 border font-bold text-green-700">{row.inAmount > 0 ? row.inAmount.toLocaleString() : '-'}</td>
                                            <td className="p-2 border font-bold text-red-700">{row.outAmount > 0 ? row.outAmount.toLocaleString() : '-'}</td>
                                            <td className="p-2 border font-bold bg-gray-50">{row.balance.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}