'use client'
import { useState, useEffect, useCallback } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger, getEmployeePerformance } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE' | 'EMPLOYEES'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 border-r-4 border-blue-600 pr-4">📊 التقارير المركزية</h1>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded-lg shadow-md hover:bg-black transition-all print:hidden flex items-center gap-2">
            <span>🖨️</span>
            <span>طباعة التقرير الحالي</span>
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b print:hidden overflow-x-auto pb-2 scrollbar-hide">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-6 py-3 font-bold whitespace-nowrap transition-all rounded-t-lg ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            📦 حركة الأصناف والمخزون
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-6 py-3 font-bold whitespace-nowrap transition-all rounded-t-lg ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            💰 دفتر الخزينة
        </button>
        <button 
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-6 py-3 font-bold whitespace-nowrap transition-all rounded-t-lg ${activeTab === 'EMPLOYEES' ? 'bg-white border-t-4 border-purple-600 text-purple-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
            👥 أداء الموظفين
        </button>
      </div>

      <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm min-h-[500px] border border-gray-100">
          {activeTab === 'INVENTORY' && <InventoryReportView />}
          {activeTab === 'SAFE' && <SafeLedgerView />}
          {activeTab === 'EMPLOYEES' && <EmployeePerformanceView />}
      </div>
    </div>
  );
}

// ===============================================
// 1. مكون تقرير حركة المخزون (النسخة الأصلية الكاملة)
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
            if (!g.colors.includes(item.color)) g.colors.push(item.color);
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

    if (loading) return <div className="text-center py-20 font-bold text-gray-500 animate-pulse">جاري تحميل بيانات المخزون...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <h2 className="text-xl font-bold text-gray-700">تقرير حركة الأصناف (بالقطعة)</h2>
                <div className="bg-gray-100 p-1 rounded-lg flex text-sm shadow-inner print:hidden">
                    <button onClick={() => { setViewMode('COLOR'); setSortConfig(null); }} className={`px-6 py-2 rounded-md transition-all ${viewMode === 'COLOR' ? 'bg-white shadow-md text-blue-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>تفصيلي (باللون)</button>
                    <button onClick={() => { setViewMode('MODEL'); setSortConfig(null); }} className={`px-6 py-2 rounded-md transition-all ${viewMode === 'MODEL' ? 'bg-white shadow-md text-blue-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>تجميعي (بالموديل)</button>
                </div>
            </div>
            
            {/* الملخص العلوي */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center shadow-sm">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">عدد الموديلات</div>
                    <div className="text-xl font-black text-blue-700">{viewMode === 'MODEL' ? displayData.length : summary.totalItems}</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center shadow-sm">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">إجمالي الرصيد الحالي (قطعة)</div>
                    <div className="text-xl font-black text-indigo-700">{summary.totalCurrentStock}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center shadow-sm">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">إجمالي المباع (قطعة)</div>
                    <div className="text-xl font-black text-yellow-700">{summary.totalSoldUnits}</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center shadow-sm">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">إجمالي قيمة المبيعات</div>
                    <div className="text-xl font-black text-orange-700">{summary.totalSalesValue?.toLocaleString()} ج.م</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center shadow-sm">
                    <div className="text-gray-500 text-[10px] font-bold mb-1">القيمة الحالية للمخزون</div>
                    <div className="text-xl font-black text-green-700">{summary.totalValue?.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* الجدول الرئيسي */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 border-b">الموديل</th>
                            <th className="p-4 border-b">{viewMode === 'COLOR' ? 'اللون' : 'الألوان المتاحة'}</th>
                            <th className="p-4 border-b bg-blue-50/50">الرصيد الأولي</th>
                            <th className="p-4 border-b bg-yellow-50/50">إجمالي المبيعات</th>
                            <th className="p-4 border-b bg-green-50/50">الرصيد الحالي</th>
                            <th className="p-4 border-b cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('salesPercentage')}>
                                نسبة المبيع {sortConfig?.key === 'salesPercentage' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-4 border-b">القيمة الحالية</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-4 font-black text-gray-900">{item.modelNo}</td>
                                <td className="p-4 text-gray-600">
                                    {viewMode === 'COLOR' ? item.color : <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full">{item.colors.join('، ')}</span>}
                                </td>
                                <td className="p-4 font-bold text-blue-700 bg-blue-50/20">{item.initialStock}</td>
                                <td className="p-4">
                                    {item.totalSold > 0 ? (
                                        <button onClick={() => openHistory(item)} className="text-yellow-700 font-black underline hover:text-yellow-900 transition-colors decoration-yellow-300 underline-offset-4">
                                            {item.totalSold} (عرض)
                                        </button>
                                    ) : (
                                        <span className="text-gray-300">0</span>
                                    )}
                                </td>
                                <td className={`p-4 font-black ${item.currentStock <= 0 ? 'text-red-600 bg-red-50/50' : 'text-green-700 bg-green-50/20'}`}>
                                    {item.currentStock}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16 hidden sm:block">
                                            <div className={`h-full rounded-full ${item.salesPercentage > 70 ? 'bg-green-500' : item.salesPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(item.salesPercentage, 100)}%` }}></div>
                                        </div>
                                        <span className="font-bold">{item.salesPercentage.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-gray-500">{item.currentValue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال تفاصيل التاريخ (النسخة الأصلية الكاملة) */}
            {selectedHistory && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-800 p-5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg">سجل مبيعات الصنف</h3>
                                <p className="text-xs text-gray-400 mt-1">{selectedItemName}</p>
                            </div>
                            <button onClick={() => setSelectedHistory(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">✕</button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-sm text-right border-collapse">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="p-3 border-b">التاريخ</th>
                                        <th className="p-3 border-b">رقم الأوردر</th>
                                        <th className="p-3 border-b">العميل</th>
                                        <th className="p-3 border-b text-center">الكمية (قطعة)</th>
                                        <th className="p-3 border-b text-left">سعر البيع</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedHistory.map((h: any, idx: number) => (
                                        <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-3 text-gray-500">{new Date(h.date).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-3 font-bold text-blue-600">#{h.orderNo}</td>
                                            <td className="p-3 font-medium">{h.customer}</td>
                                            <td className="p-3 text-center font-black text-lg">{h.quantity}</td>
                                            <td className="p-3 text-left font-mono text-gray-600">{h.price} ج.م</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-gray-50 p-4 text-center border-t">
                            <button onClick={() => setSelectedHistory(null)} className="bg-gray-800 text-white px-10 py-2.5 rounded-xl font-bold shadow-lg shadow-gray-200 hover:bg-black transition-all">إغلاق النافذة</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===============================================
// 2. مكون دفتر الخزينة (النسخة الأصلية الكاملة مع فصل العملات ✅)
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

    useEffect(() => {
        fetchLedgerData();
    }, [fetchLedgerData]);

    const getCurrencyName = (code: string) => {
        const names: any = { 'EGP': 'جنيه مصري', 'USD': 'دولار أمريكي', 'SAR': 'ريال سعودي', 'KWD': 'دينار كويتي' };
        return names[code] || code;
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2 text-gray-700">دفتر أستاذ الخزينة التفصيلي</h2>
            
            {/* فلتر البحث */}
            <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-5 rounded-2xl border border-gray-100 print:hidden shadow-inner">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-black mb-1.5 text-gray-500 uppercase tracking-wider">اختر الخزنة المستهدفة</label>
                    <select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-green-500">
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-black mb-1.5 text-gray-500">الفترة من</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-xl shadow-sm" />
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-black mb-1.5 text-gray-500">الفترة إلى</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-xl shadow-sm" />
                </div>
                <button onClick={fetchLedgerData} className="bg-green-600 text-white px-8 py-2.5 rounded-xl font-black hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center gap-2">
                    تحديث البيانات ⟳
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 font-bold text-gray-400">جاري تحميل حركات الخزينة...</div>
            ) : (
                <>
                    {/* 👇 عرض بطاقات ملخص لكل عملة بشكل منفصل (بناءً على طلبك بالصورة) 👇 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                        {Object.entries(summaryGrouped).map(([curr, totals]: any) => (
                            <div key={curr} className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-md transform hover:-translate-y-1 transition-transform">
                                <div className="bg-slate-900 text-white p-2.5 text-center font-black text-sm flex justify-center items-center gap-2">
                                    <span>💰</span>
                                    <span>رصيد الـ {getCurrencyName(curr)}</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-bold">إجمالي الوارد:</span>
                                        <span className="text-green-600 font-black">+{totals.in.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-bold">إجمالي الصادر:</span>
                                        <span className="text-red-600 font-black">-{totals.out.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                                        <span className="font-bold text-slate-800">الصافي:</span>
                                        <span className="text-xl font-black text-slate-900">{totals.balance.toLocaleString()} <small className="text-[10px] text-gray-500">{curr}</small></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {Object.keys(summaryGrouped).length === 0 && (
                            <div className="col-span-full bg-gray-50 p-10 rounded-2xl border border-dashed text-center text-gray-400 font-bold">
                                لا توجد حركات مالية مسجلة في هذه الفترة
                            </div>
                        )}
                    </div>

                    {/* جدول الحركات */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-100 text-gray-600 font-black uppercase text-xs">
                                <tr>
                                    <th className="p-4 border-b">التاريخ</th>
                                    <th className="p-4 border-b">نوع الحركة</th>
                                    <th className="p-4 border-b">البيان / التفاصيل</th>
                                    <th className="p-4 border-b text-center">العملة</th>
                                    <th className="p-4 border-b text-green-700 bg-green-50/50">وارد (+)</th>
                                    <th className="p-4 border-b text-red-700 bg-red-50/50">صادر (-)</th>
                                    <th className="p-4 border-b text-gray-400 font-normal">بواسطة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {ledger.map((row: any) => (
                                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-gray-500 font-mono text-xs">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-4 font-black text-gray-700 text-xs">
                                            <span className={`px-2 py-1 rounded-md ${row.type.includes('وارد') || row.type.includes('قبض') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-700 font-medium max-w-[200px] truncate">{row.description}</td>
                                        <td className="p-4 text-center font-black text-blue-600">{row.currency}</td>
                                        <td className="p-4 font-black text-green-700 bg-green-50/10">{row.inAmount > 0 ? row.inAmount.toLocaleString() : '-'}</td>
                                        <td className="p-4 font-black text-red-700 bg-red-50/10">{row.outAmount > 0 ? row.outAmount.toLocaleString() : '-'}</td>
                                        <td className="p-4 text-xs text-gray-400">{row.user}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

// ===============================================
// 3. مكون تقرير أداء الموظفين (النسخة الأصلية الكاملة)
// ===============================================
function EmployeePerformanceView() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        getEmployeePerformance().then(res => {
            if (res.success) {
                setData(res.data || []);
            }
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

    if (loading) return <div className="text-center py-20 font-bold text-gray-400">جاري تحميل بيانات الأداء...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2 text-gray-700">تقرير كفاءة مبيعات الموظفين</h2>
            
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-purple-600 text-white font-bold">
                        <tr>
                            <th className="p-4 border-b border-purple-700">اسم الموظف</th>
                            <th className="p-4 border-b border-purple-700">كود الدخول</th>
                            <th className="p-4 border-b border-purple-700 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('orderCount')}>
                                عدد الأوردرات {sortConfig?.key === 'orderCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-4 border-b border-purple-700 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('totalSales')}>
                                إجمالي المبيعات {sortConfig?.key === 'totalSales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-4 border-b border-purple-700 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('totalDiscount')}>
                                الخصومات الممنوحة {sortConfig?.key === 'totalDiscount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedData.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-purple-50 transition-colors group">
                                <td className="p-4 font-black text-gray-900">{emp.name}</td>
                                <td className="p-4 font-mono text-gray-400 text-xs">{emp.code}</td>
                                <td className="p-4 text-center font-black text-lg text-gray-700">{emp.orderCount}</td>
                                <td className="p-4 font-black text-green-700 text-lg">{emp.totalSales.toLocaleString()} ج.م</td>
                                <td className="p-4 font-bold text-red-600">{emp.totalDiscount.toLocaleString()} ج.م</td>
                            </tr>
                        ))}
                        {sortedData.length === 0 && (
                            <tr><td colSpan={5} className="p-10 text-center text-gray-400 font-bold">لا توجد عمليات بيع مسجلة لهذا اليوم</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}