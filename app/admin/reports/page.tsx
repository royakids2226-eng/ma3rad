'use client'
import { useState, useEffect, useCallback } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger, getEmployeePerformance } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE' | 'EMPLOYEES'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 التقارير المركزية</h1>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-black print:hidden">
            🖨️ طباعة التقرير
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b print:hidden overflow-x-auto">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            📦 حركة الأصناف والمخزون
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            💰 دفتر الخزينة
        </button>
        <button 
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-6 py-3 font-bold whitespace-nowrap ${activeTab === 'EMPLOYEES' ? 'bg-white border-t-4 border-purple-600 text-purple-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            👥 أداء الموظفين
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow min-h-[500px]">
          {activeTab === 'INVENTORY' && <InventoryReportView />}
          {activeTab === 'SAFE' && <SafeLedgerView />}
          {activeTab === 'EMPLOYEES' && <EmployeePerformanceView />}
      </div>
    </div>
  );
}

// ===============================================
// 1. مكون تقرير حركة المخزون (كامل بدون حذف)
// ===============================================
function InventoryReportView() {
    const [data, setData] = useState<any[]>([]); 
    const [summary, setSummary] = useState<any>({});
    const [loading, setLoading] = useState(true);
    
    const [viewMode, setViewMode] = useState<'COLOR' | 'MODEL'>('COLOR');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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

    let displayData = viewMode === 'COLOR' ? data : getGroupedData();

    displayData = displayData.map((item: any) => ({
        ...item,
        salesPercentage: item.initialStock > 0 ? (item.totalSold / item.initialStock) * 100 : 0
    }));

    if (sortConfig !== null) {
        displayData.sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
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
                    <button onClick={() => setViewMode('COLOR')} className={`px-4 py-1 rounded-md ${viewMode === 'COLOR' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-500'}`}>تفصيلي</button>
                    <button onClick={() => setViewMode('MODEL')} className={`px-4 py-1 rounded-md ${viewMode === 'MODEL' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-500'}`}>بالموديل</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-3 rounded border text-center font-bold text-blue-700">عدد الموديلات: {summary.totalItems}</div>
                <div className="bg-indigo-50 p-3 rounded border text-center font-bold text-indigo-700">المتاح: {summary.totalCurrentStock}</div>
                <div className="bg-yellow-50 p-3 rounded border text-center font-bold text-yellow-700">المباع: {summary.totalSoldUnits}</div>
                <div className="bg-orange-50 p-3 rounded border text-center font-bold text-orange-700">مبيعات: {summary.totalSalesValue?.toLocaleString()} ج.م</div>
                <div className="bg-green-50 p-3 rounded border text-center font-bold text-green-700">قيمة المخزون: {summary.totalValue?.toLocaleString()} ج.م</div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th className="p-3 border">الموديل</th>
                            <th className="p-3 border">{viewMode === 'COLOR' ? 'اللون' : 'الألوان المتاحة'}</th>
                            <th className="p-3 border bg-blue-50">الرصيد الأولي</th>
                            <th className="p-3 border bg-yellow-50">إجمالي المبيعات</th>
                            <th className="p-3 border bg-green-50">الرصيد الحالي</th>
                            <th className="p-3 border cursor-pointer hover:bg-gray-200" onClick={() => handleSort('salesPercentage')}>نسبة المبيع {sortConfig?.key === 'salesPercentage' && (sortConfig.direction === 'asc' ? '⬆️' : '⬇️')}</th>
                            <th className="p-3 border">القيمة الحالية</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-2 border font-bold">{item.modelNo}</td>
                                <td className="p-2 border">{viewMode === 'COLOR' ? item.color : item.colors.join('، ')}</td>
                                <td className="p-2 border font-bold text-blue-700">{item.initialStock}</td>
                                <td className="p-2 border">{item.totalSold > 0 ? <button onClick={() => openHistory(item)} className="text-yellow-700 font-bold underline">{item.totalSold}</button> : '0'}</td>
                                <td className={`p-2 border font-bold ${item.currentStock <= 0 ? 'text-red-600' : 'text-green-700'}`}>{item.currentStock}</td>
                                <td className="p-2 border font-bold">{item.salesPercentage.toFixed(1)}%</td>
                                <td className="p-2 border">{item.currentValue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedHistory && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center"><h3 className="font-bold">تفاصيل مبيعات: {selectedItemName}</h3><button onClick={() => setSelectedHistory(null)}>✕</button></div>
                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50"><tr><th className="p-2 border">التاريخ</th><th className="p-2 border">رقم الأوردر</th><th className="p-2 border">العميل</th><th className="p-2 border">الكمية</th></tr></thead>
                                <tbody>{selectedHistory.map((h: any, idx: number) => (<tr key={idx} className="border-b"><td className="p-2">{new Date(h.date).toLocaleDateString('ar-EG')}</td><td className="p-2">#{h.orderNo}</td><td className="p-2">{h.customer}</td><td className="p-2 font-bold text-blue-600">{h.quantity}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===============================================
// 2. مكون دفتر الخزينة (فصل العملات ✅)
// ===============================================
function SafeLedgerView() {
    const getTodayDateString = () => new Date().toISOString().split('T')[0];
    const [safes, setSafes] = useState<any[]>([]);
    const [selectedSafe, setSelectedSafe] = useState('');
    const [startDate, setStartDate] = useState(getTodayDateString());
    const [endDate, setEndDate] = useState(getTodayDateString());
    const [ledger, setLedger] = useState<any[]>([]);
    const [summaryGrouped, setSummaryGrouped] = useState<any>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getSafesList().then(data => { 
            setSafes(data); 
            if(data.length > 0) setSelectedSafe(data[0].id); 
        });
    }, []);

    const fetchLedgerData = useCallback(async () => {
        if(!selectedSafe) return;
        setLoading(true);
        const res = await getSafeLedger(selectedSafe, startDate, endDate);
        if(res.success) { 
            setLedger(res.data || []); 
            setSummaryGrouped(res.summaryGrouped || {}); 
        }
        setLoading(false);
    }, [selectedSafe, startDate, endDate]);

    useEffect(() => { fetchLedgerData(); }, [fetchLedgerData]);

    const getCurrencyName = (code: string) => {
        const names: any = { 'EGP': 'جنيه مصري', 'USD': 'دولار أمريكي', 'SAR': 'ريال سعودي', 'KWD': 'دينار كويتي' };
        return names[code] || code;
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">دفتر أستاذ الخزينة</h2>
            <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded border print:hidden">
                <div className="flex-1 min-w-[200px]"><label className="block text-xs font-bold mb-1 text-gray-500">اختر الخزنة</label><select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-2 border rounded">{safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="block text-xs font-bold mb-1 text-gray-500">من تاريخ</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded" /></div>
                <div><label className="block text-xs font-bold mb-1 text-gray-500">إلى تاريخ</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded" /></div>
                <button onClick={fetchLedgerData} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 h-[42px]">تحديث ⟳</button>
            </div>

            {loading ? <div className="text-center py-10">جاري التحميل...</div> : (
                <>
                    {/* 👇 عرض بطاقات ملخص لكل عملة بشكل منفصل 👇 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {Object.entries(summaryGrouped).map(([curr, totals]: any) => (
                            <div key={curr} className="bg-white border-2 border-gray-800 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-gray-800 text-white p-2 text-center font-bold text-sm">
                                    رصيد الـ {getCurrencyName(curr)}
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="flex justify-between text-xs"><span>إجمالي الوارد:</span><span className="text-green-600 font-bold">+{totals.in.toLocaleString()}</span></div>
                                    <div className="flex justify-between text-xs"><span>إجمالي الصادر:</span><span className="text-red-600 font-bold">-{totals.out.toLocaleString()}</span></div>
                                    <div className="flex justify-between border-t pt-1 font-bold text-lg"><span>الصافي:</span><span>{totals.balance.toLocaleString()} {curr}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 border">التاريخ</th>
                                    <th className="p-2 border">نوع الحركة</th>
                                    <th className="p-2 border">البيان</th>
                                    <th className="p-2 border">العملة</th>
                                    <th className="p-2 border bg-green-50 text-green-800">وارد (+)</th>
                                    <th className="p-2 border bg-red-50 text-red-800">صادر (-)</th>
                                    <th className="p-2 border text-xs">المستلم</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.length === 0 ? (
                                    <tr><td colSpan={7} className="p-4 text-center text-gray-500">لا توجد حركات</td></tr>
                                ) : (
                                    ledger.map((row: any) => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="p-2 border whitespace-nowrap">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-2 border font-bold text-xs">{row.type}</td>
                                            <td className="p-2 border">{row.description}</td>
                                            <td className="p-2 border text-center font-bold text-blue-600">{row.currency}</td>
                                            <td className="p-2 border font-bold text-green-700">{row.inAmount > 0 ? row.inAmount.toLocaleString() : '-'}</td>
                                            <td className="p-2 border font-bold text-red-700">{row.outAmount > 0 ? row.outAmount.toLocaleString() : '-'}</td>
                                            <td className="p-2 border text-xs">{row.user}</td>
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

// ===============================================
// 3. مكون تقرير أداء الموظفين (كامل مع حسابات الخصومات)
// ===============================================
function EmployeePerformanceView() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        getEmployeePerformance().then(res => {
            if (res.success) setData(res.data || []);
            setLoading(false);
        });
    }, []);

    const sortedData = [...data];
    if (sortConfig !== null) {
        sortedData.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    if (loading) return <div>جاري تحميل بيانات الموظفين...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">تقرير أداء الموظفين</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-purple-100 text-purple-900">
                        <tr>
                            <th className="p-3 border">الموظف</th>
                            <th className="p-3 border">الكود</th>
                            <th className="p-3 border cursor-pointer select-none" onClick={() => handleSort('orderCount')}>عدد الأوردرات {sortConfig?.key === 'orderCount' && (sortConfig.direction === 'asc' ? '⬆️' : '⬇️')}</th>
                            <th className="p-3 border cursor-pointer select-none" onClick={() => handleSort('totalSales')}>إجمالي المبيعات {sortConfig?.key === 'totalSales' && (sortConfig.direction === 'asc' ? '⬆️' : '⬇️')}</th>
                            <th className="p-3 border cursor-pointer select-none" onClick={() => handleSort('totalDiscount')}>إجمالي الخصومات {sortConfig?.key === 'totalDiscount' && (sortConfig.direction === 'asc' ? '⬆️' : '⬇️')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-purple-50">
                                <td className="p-3 border font-bold">{emp.name}</td>
                                <td className="p-3 border font-mono">{emp.code}</td>
                                <td className="p-3 border text-center font-bold text-lg">{emp.orderCount}</td>
                                <td className="p-3 border font-bold text-green-700">{emp.totalSales.toLocaleString()} ج.م</td>
                                <td className="p-3 border text-red-600 font-bold">{emp.totalDiscount.toLocaleString()} ج.م</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}