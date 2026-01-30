'use client'
import { useState, useEffect } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 التقارير المركزية</h1>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-black print:hidden">
            🖨️ طباعة التقرير
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b print:hidden">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-6 py-3 font-bold ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            📦 حركة الأصناف والمخزون
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-6 py-3 font-bold ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            💰 دفتر الخزينة
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow min-h-[500px]">
          {activeTab === 'INVENTORY' && <InventoryReportView />}
          {activeTab === 'SAFE' && <SafeLedgerView />}
      </div>
    </div>
  );
}

// ===============================================
// مكون تقرير حركة المخزون
// ===============================================
function InventoryReportView() {
    const [data, setData] = useState<any[]>([]); 
    const [summary, setSummary] = useState<any>({});
    const [loading, setLoading] = useState(true);
    
    // حالة وضع العرض
    const [viewMode, setViewMode] = useState<'COLOR' | 'MODEL'>('COLOR');

    // حالة الترتيب
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // حالة المودال
    const [selectedHistory, setSelectedHistory] = useState<any[] | null>(null);
    const [selectedItemName, setSelectedItemName] = useState('');

    useEffect(() => {
        getInventoryReport().then(res => {
            if(res.success) {
                setData(res.data || []);
                setSummary(res.summary || {});
            }
            setLoading(false);
        });
    }, []);

    // دالة تجميع البيانات حسب الموديل
    const getGroupedData = () => {
        const groups: any = {};
        
        data.forEach(item => {
            if (!groups[item.modelNo]) {
                groups[item.modelNo] = {
                    id: item.modelNo,
                    modelNo: item.modelNo,
                    colors: [], 
                    initialStock: 0,
                    totalSold: 0,
                    currentStock: 0,
                    currentValue: 0,
                    status: 'MIXED',
                    history: []
                };
            }
            
            const g = groups[item.modelNo];
            g.colors.push(item.color);
            g.initialStock += item.initialStock;
            g.totalSold += item.totalSold;
            g.currentStock += item.currentStock;
            g.currentValue += item.currentValue;
            g.history = [...g.history, ...item.history];
        });

        return Object.values(groups);
    };

    // 1. تحديد البيانات الأساسية
    let displayData = viewMode === 'COLOR' ? data : getGroupedData();

    // 2. إضافة حساب نسبة المبيع لكل صف
    displayData = displayData.map((item: any) => ({
        ...item,
        salesPercentage: item.initialStock > 0 ? (item.totalSold / item.initialStock) * 100 : 0
    }));

    // 3. تطبيق الترتيب
    if (sortConfig !== null) {
        displayData.sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const openHistory = (item: any) => {
        if (item.totalSold > 0) {
            const name = viewMode === 'COLOR' 
                ? `${item.modelNo} - ${item.color}` 
                : `موديل ${item.modelNo} (كل الألوان)`;
            
            setSelectedItemName(name);
            const sortedHistory = [...item.history].sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setSelectedHistory(sortedHistory);
        }
    };

    if (loading) return <div>جاري تحميل المخزون...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xl font-bold">تقرير حركة الأصناف</h2>
                
                <div className="bg-gray-100 p-1 rounded-lg flex text-sm print:hidden">
                    <button 
                        onClick={() => { setViewMode('COLOR'); setSortConfig(null); }}
                        className={`px-4 py-1 rounded-md transition ${viewMode === 'COLOR' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-500'}`}
                    >
                        تفصيلي (باللون)
                    </button>
                    <button 
                        onClick={() => { setViewMode('MODEL'); setSortConfig(null); }}
                        className={`px-4 py-1 rounded-md transition ${viewMode === 'MODEL' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-500'}`}
                    >
                        تجميعي (بالموديل)
                    </button>
                </div>
            </div>
            
            {/* 👇 الملخص (تم تعديله ليصبح 5 أعمدة) */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-3 rounded border border-blue-200 text-center">
                    <div className="text-gray-500 text-xs">عدد الموديلات</div>
                    <div className="text-xl font-bold text-blue-700">
                        {viewMode === 'MODEL' ? displayData.length : summary.totalItems}
                    </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-200 text-center">
                    <div className="text-gray-500 text-xs">إجمالي الرصيد الحالي (قطعة)</div>
                    <div className="text-xl font-bold text-indigo-700">{summary.totalCurrentStock}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-center">
                    <div className="text-gray-500 text-xs">إجمالي المباع (قطعة)</div>
                    <div className="text-xl font-bold text-yellow-700">{summary.totalSoldUnits}</div>
                </div>
                
                {/* 👇 الكارت الجديد: قيمة المبيعات */}
                <div className="bg-orange-50 p-3 rounded border border-orange-200 text-center">
                    <div className="text-gray-500 text-xs">إجمالي قيمة المبيعات</div>
                    <div className="text-xl font-bold text-orange-700">{summary.totalSalesValue?.toLocaleString()} ج.م</div>
                </div>

                <div className="bg-green-50 p-3 rounded border border-green-200 text-center">
                    <div className="text-gray-500 text-xs">القيمة الحالية للمخزون</div>
                    <div className="text-xl font-bold text-green-700">{summary.totalValue?.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* الجدول */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th className="p-3 border">الموديل</th>
                            <th className="p-3 border">
                                {viewMode === 'COLOR' ? 'اللون' : 'الألوان المتاحة'}
                            </th>
                            <th className="p-3 border bg-blue-50">الرصيد الأولي</th>
                            <th className="p-3 border bg-yellow-50">إجمالي المبيعات</th>
                            <th className="p-3 border bg-green-50">الرصيد الحالي</th>
                            
                            <th 
                                className="p-3 border cursor-pointer hover:bg-gray-200 transition select-none"
                                onClick={() => handleSort('salesPercentage')}
                                title="اضغط للترتيب"
                            >
                                نسبة المبيع 
                                {sortConfig?.key === 'salesPercentage' && (
                                    <span className="mr-1 text-blue-600">
                                        {sortConfig.direction === 'asc' ? '⬆️' : '⬇️'}
                                    </span>
                                )}
                            </th>

                            {viewMode === 'COLOR' && <th className="p-3 border">الحالة</th>}
                            <th className="p-3 border">القيمة الحالية</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-2 border font-bold">{item.modelNo}</td>
                                
                                <td className="p-2 border">
                                    {viewMode === 'COLOR' ? item.color : (
                                        <span className="text-xs text-gray-600">
                                            {item.colors.length} ألوان ({item.colors.join('، ')})
                                        </span>
                                    )}
                                </td>
                                
                                <td className="p-2 border font-bold text-blue-700">{item.initialStock}</td>
                                
                                <td className="p-2 border">
                                    {item.totalSold > 0 ? (
                                        <button 
                                            onClick={() => openHistory(item)}
                                            className="text-yellow-700 font-bold underline hover:text-yellow-900"
                                        >
                                            {item.totalSold} (عرض التفاصيل)
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </td>

                                <td className={`p-2 border font-bold ${item.currentStock <= 0 ? 'text-red-600 bg-red-50' : 'text-green-700'}`}>
                                    {item.currentStock}
                                </td>

                                <td className={`p-2 border font-bold ${item.salesPercentage > 50 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.salesPercentage.toFixed(1)}%
                                </td>

                                {viewMode === 'COLOR' && (
                                    <td className="p-2 border text-xs">{item.status === 'OPEN' ? 'مفتوح' : 'مغلق'}</td>
                                )}
                                
                                <td className="p-2 border">{item.currentValue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال التفاصيل */}
            {selectedHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">تفاصيل مبيعات: {selectedItemName}</h3>
                            <button onClick={() => setSelectedHistory(null)} className="text-red-500 font-bold text-xl">&times;</button>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 border">التاريخ</th>
                                        <th className="p-2 border">رقم الأوردر</th>
                                        <th className="p-2 border">العميل</th>
                                        <th className="p-2 border">الكمية</th>
                                        <th className="p-2 border">سعر البيع</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedHistory.map((h: any, idx: number) => (
                                        <tr key={idx} className="border-b">
                                            <td className="p-2">{new Date(h.date).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-2 font-bold">#{h.orderNo}</td>
                                            <td className="p-2">{h.customer}</td>
                                            <td className="p-2 font-bold text-blue-600">{h.quantity}</td>
                                            <td className="p-2">{h.price}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-gray-50 p-3 text-center border-t">
                            <button onClick={() => setSelectedHistory(null)} className="bg-gray-800 text-white px-6 py-2 rounded">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===============================================
// SafeLedgerView (كما هو)
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
            setLedger(res.data || []);
            setSummary({ totalIn: res.totalIn || 0, currentBalance: res.currentBalance || 0 });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">دفتر أستاذ الخزينة</h2>
            <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded border print:hidden">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold mb-1">اختر الخزنة</label>
                    <select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-2 border rounded">
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div><label className="block text-xs font-bold mb-1">من تاريخ</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded" /></div>
                <div><label className="block text-xs font-bold mb-1">إلى تاريخ</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded" /></div>
                <button onClick={handleSearch} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 h-[42px]">عرض التقرير 🔍</button>
            </div>
            {loading ? <div className="text-center py-10">جاري التحميل...</div> : (
                <>
                    <div className="flex gap-4 mb-4">
                        <div className="bg-green-100 p-3 rounded border border-green-300 flex-1 text-center">
                            <span className="block text-xs text-green-800">إجمالي الوارد</span>
                            <span className="block text-xl font-bold text-green-900">{summary.totalIn?.toLocaleString() || 0} ج.م</span>
                        </div>
                        <div className="bg-gray-800 p-3 rounded border border-gray-900 flex-1 text-center text-white">
                            <span className="block text-xs text-gray-400">الرصيد الحالي</span>
                            <span className="block text-xl font-bold">{summary.currentBalance?.toLocaleString() || 0} ج.م</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 border">التاريخ</th>
                                    <th className="p-2 border">نوع الحركة</th>
                                    <th className="p-2 border">البيان</th>
                                    <th className="p-2 border">المستلم</th>
                                    <th className="p-2 border bg-green-50 text-green-800">وارد (+)</th>
                                    <th className="p-2 border bg-red-50 text-red-800">صادر (-)</th>
                                    <th className="p-2 border bg-gray-200">الرصيد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.length === 0 ? (<tr><td colSpan={7} className="p-4 text-center text-gray-500">لا توجد حركات</td></tr>) : (
                                    ledger.map((row: any) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="p-2 border whitespace-nowrap">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
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