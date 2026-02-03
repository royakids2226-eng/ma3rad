'use client'
import { useState, useEffect, useCallback } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger, getEmployeePerformance } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE' | 'EMPLOYEES'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      {/* ========================================================================
          HEADER SECTION - الجزء العلوي للتحكم والطباعة
          ======================================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 text-white">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-800 tracking-tight">التقارير والإحصائيات المركزية</h1>
            <p className="text-gray-400 text-sm mt-1 font-bold">مراقبة المخزون، التدفقات النقدية، وتقييم الموظفين</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => window.print()} 
              className="flex-1 md:flex-none bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-3 print:hidden"
            >
                <span className="text-xl">🖨️</span>
                <span>طباعة التقرير</span>
            </button>
        </div>
      </div>

      {/* ========================================================================
          TABS NAVIGATION - أزرار التنقل الرئيسية
          ======================================================================== */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 print:hidden overflow-x-auto pb-2 scrollbar-hide">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-10 py-5 font-black whitespace-nowrap transition-all rounded-t-3xl flex items-center gap-3 ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-[0_-4px_15px_rgba(0,0,0,0.08)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-2xl">📦</span>
            المخزون وحركة الأصناف
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-10 py-5 font-black whitespace-nowrap transition-all rounded-t-3xl flex items-center gap-3 ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-[0_-4px_15px_rgba(0,0,0,0.08)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-2xl">💰</span>
            دفتر أستاذ الخزينة
        </button>
        <button 
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-10 py-5 font-black whitespace-nowrap transition-all rounded-t-3xl flex items-center gap-3 ${activeTab === 'EMPLOYEES' ? 'bg-white border-t-4 border-purple-600 text-purple-700 shadow-[0_-4px_15px_rgba(0,0,0,0.08)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-2xl">👥</span>
            أداء فريق المبيعات
        </button>
      </div>

      {/* ========================================================================
          MAIN CONTENT AREA - المحتوى المتغير حسب التبويب
          ======================================================================== */}
      <div className="bg-white p-4 md:p-10 rounded-[2.5rem] shadow-sm min-h-[600px] border border-gray-50">
          {activeTab === 'INVENTORY' && <InventoryReportView />}
          {activeTab === 'SAFE' && <SafeLedgerView />}
          {activeTab === 'EMPLOYEES' && <EmployeePerformanceView />}
      </div>
    </div>
  );
}

// ===============================================
// 1. مكون تقرير حركة المخزون
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
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    const openHistory = (item: any) => {
        if (item.totalSold > 0) {
            const name = viewMode === 'COLOR' ? `${item.modelNo} - ${item.color}` : `موديل ${item.modelNo}`;
            setSelectedItemName(name);
            const sortedHistory = [...item.history].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSelectedHistory(sortedHistory);
        }
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center py-40 gap-4">
            <div className="w-14 h-14 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="font-black text-xl text-gray-400">جاري جرد المستودع...</div>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-100 pb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-800">تحليل المخزون والأصناف</h2>
                    <p className="text-blue-500 font-bold mt-2">ملاحظة: الرصيد الأولي ثابت ويساوي (المتاح حالياً + المبيعات التاريخية بالقطعة)</p>
                </div>
                <div className="bg-gray-100 p-2 rounded-2xl flex text-sm shadow-inner print:hidden">
                    <button onClick={() => { setViewMode('COLOR'); setSortConfig(null); }} className={`px-10 py-3 rounded-xl transition-all ${viewMode === 'COLOR' ? 'bg-white shadow-xl text-blue-700 font-black' : 'text-gray-500 hover:text-gray-700'}`}>عرض الألوان</button>
                    <button onClick={() => { setViewMode('MODEL'); setSortConfig(null); }} className={`px-10 py-3 rounded-xl transition-all ${viewMode === 'MODEL' ? 'bg-white shadow-xl text-blue-700 font-black' : 'text-gray-500 hover:text-gray-700'}`}>عرض الموديلات</button>
                </div>
            </div>
            
            {/* 👇 تعديل: تكبير فونت اختصارات الأرصدة (Summary Cards) 👇 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-[2rem] border border-blue-100 shadow-sm relative overflow-hidden group">
                    <div className="text-blue-500 text-xs font-black uppercase mb-2 tracking-widest">عدد الموديلات</div>
                    <div className="text-5xl font-black text-blue-800 tracking-tighter">{viewMode === 'MODEL' ? displayData.length : summary.totalItems}</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[2rem] border border-indigo-100 shadow-sm relative overflow-hidden group">
                    <div className="text-indigo-500 text-xs font-black uppercase mb-2 tracking-widest">الرصيد الحالي (قطعة)</div>
                    <div className="text-5xl font-black text-indigo-800 tracking-tighter">{summary.totalCurrentStock}</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-white p-8 rounded-[2rem] border border-yellow-100 shadow-sm relative overflow-hidden group">
                    <div className="text-yellow-600 text-xs font-black uppercase mb-2 tracking-widest">إجمالي المباع (قطعة)</div>
                    <div className="text-5xl font-black text-yellow-700 tracking-tighter">{summary.totalSoldUnits}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white p-8 rounded-[2rem] border border-orange-100 shadow-sm relative overflow-hidden group">
                    <div className="text-orange-500 text-xs font-black uppercase mb-2 tracking-widest">إجمالي المبيعات</div>
                    <div className="text-4xl font-black text-orange-700 tracking-tighter">{summary.totalSalesValue?.toLocaleString()} <small className="text-xs">ج.م</small></div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-white p-8 rounded-[2rem] border border-green-100 shadow-sm relative overflow-hidden group">
                    <div className="text-green-500 text-xs font-black uppercase mb-2 tracking-widest">قيمة المخزون</div>
                    <div className="text-4xl font-black text-green-700 tracking-tighter">{summary.totalValue?.toLocaleString()} <small className="text-xs">ج.م</small></div>
                </div>
            </div>

            {/* الجدول الرئيسي */}
            <div className="overflow-x-auto rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-slate-900 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
                        <tr>
                            <th className="p-6 text-white border-b border-slate-800">كود الموديل</th>
                            <th className="p-6 border-b border-slate-800">{viewMode === 'COLOR' ? 'اللون' : 'الألوان المتاحة'}</th>
                            <th className="p-6 border-b border-slate-800 bg-blue-900/20 text-blue-400">الرصيد الأولي (قطعة)</th>
                            <th className="p-6 border-b border-slate-800 bg-yellow-900/20 text-yellow-400">المباع (قطعة)</th>
                            <th className="p-6 border-b border-slate-800 bg-green-900/20 text-green-400">الرصيد الحالي (قطعة)</th>
                            <th className="p-6 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors select-none" onClick={() => handleSort('salesPercentage')}>
                                نسبة المبيع {sortConfig?.key === 'salesPercentage' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-6 border-b border-slate-800">الحالة</th>
                            <th className="p-6 border-b border-slate-800">القيمة المالية</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {displayData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-blue-50/50 transition-all group">
                                <td className="p-6 font-black text-gray-900 text-xl group-hover:text-blue-600 transition-colors">{item.modelNo}</td>
                                <td className="p-6 text-gray-500 font-medium italic">
                                    {viewMode === 'COLOR' ? item.color : <span className="bg-gray-100 px-3 py-1 rounded-xl text-[10px] font-bold text-gray-400">{item.colors.join('، ')}</span>}
                                </td>
                                <td className="p-6 font-bold text-blue-700 bg-blue-50/20">{item.initialStock}</td>
                                <td className="p-6">
                                    {item.totalSold > 0 ? (
                                        <button 
                                          onClick={() => openHistory(item)} 
                                          className="bg-yellow-500 text-white px-5 py-2 rounded-2xl font-black hover:bg-yellow-600 transition-all shadow-lg shadow-yellow-100 active:scale-95"
                                        >
                                            {item.totalSold}
                                        </button>
                                    ) : (
                                        <span className="text-gray-300 font-bold pr-4">0</span>
                                    )}
                                </td>
                                <td className={`p-6 font-black text-2xl ${item.currentStock <= 0 ? 'text-red-600 bg-red-50/50 animate-pulse' : 'text-green-700 bg-green-50/10'}`}>
                                    {item.currentStock}
                                </td>
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden w-20 hidden sm:block border border-gray-200 shadow-inner">
                                            <div 
                                              className={`h-full rounded-full transition-all duration-1000 ease-out ${item.salesPercentage > 70 ? 'bg-green-500' : item.salesPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                              style={{ width: `${Math.min(item.salesPercentage, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="font-black text-sm text-gray-700">{item.salesPercentage.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="p-6">
                                    {item.status === 'OPEN' ? (
                                        <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm">مفتوح</span>
                                    ) : (
                                        <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm">مغلق</span>
                                    )}
                                </td>
                                <td className="p-6 font-mono font-bold text-lg text-slate-400">
                                    {item.currentValue.toLocaleString()} <small className="text-[9px]">ج.م</small>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال تفاصيل التاريخ (النسخة الأصلية الكاملة) */}
            {selectedHistory && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex justify-center items-center p-4 animate-in fade-in duration-500" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute right-0 top-0 opacity-10 text-[12rem] pointer-events-none">📈</div>
                            <div className="relative z-10">
                                <h3 className="font-black text-3xl tracking-tight">سجل حركة الصنف</h3>
                                <p className="text-slate-400 text-sm mt-2 font-bold">تحليل مبيعات: {selectedItemName}</p>
                            </div>
                            <button onClick={() => setSelectedHistory(null)} className="w-14 h-14 flex items-center justify-center rounded-3xl bg-white/10 hover:bg-white/20 transition-all text-3xl">✕</button>
                        </div>
                        <div className="p-10 max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-sm text-right border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b">تاريخ الحركة</th>
                                        <th className="p-4 border-b">رقم الفاتورة</th>
                                        <th className="p-4 border-b">العميل</th>
                                        <th className="p-4 border-b text-center text-blue-600">الكمية (قطعة)</th>
                                        <th className="p-4 border-b text-left">سعر البيع</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedHistory.map((h: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-5 text-gray-500 font-mono text-xs">{new Date(h.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td className="p-5 font-black text-blue-600">#{h.orderNo}</td>
                                            <td className="p-5 font-black text-gray-700">{h.customer}</td>
                                            <td className="p-5 text-center font-black text-2xl text-slate-900">{h.quantity}</td>
                                            <td className="p-5 text-left font-mono font-black text-green-600 text-lg">{h.price} <small className="text-[10px] font-normal">ج.م</small></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50 p-10 text-center border-t border-gray-100">
                            <button 
                              onClick={() => setSelectedHistory(null)} 
                              className="bg-slate-900 text-white px-24 py-5 rounded-[2rem] font-black shadow-2xl shadow-gray-400 hover:scale-105 active:scale-95 transition-all text-xl"
                            >
                                إغلاق السجل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===============================================
// 2. مكون دفتر الخزينة (النسخة الأصلية الكاملة مع فصل العملات)
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
        getSafesList().then(data => { setSafes(data); if(data.length > 0) setSelectedSafe(data[0].id); });
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
        <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
            <h2 className="text-3xl font-black text-gray-800 border-b pb-6">دفتر الأستاذ الموحد للخزينة</h2>
            
            <div className="flex flex-wrap gap-4 items-end bg-slate-100/50 p-8 rounded-[2.5rem] border border-slate-200/50 shadow-inner print:hidden">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-[10px] font-black mb-3 text-slate-500 uppercase tracking-[0.2em]">اختر الخزنة المستهدفة</label>
                    <select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-[1.2rem] shadow-sm outline-none focus:ring-4 focus:ring-green-500/20 font-bold transition-all">
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-black mb-3 text-slate-500">الفترة من</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-[1.2rem] shadow-sm font-bold" />
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-black mb-3 text-slate-500">الفترة إلى</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-[1.2rem] shadow-sm font-bold" />
                </div>
                <button onClick={fetchLedgerData} className="w-full sm:w-auto bg-green-600 text-white px-14 py-4 rounded-[1.2rem] font-black shadow-2xl shadow-green-200 hover:bg-green-700 hover:scale-105 transition-all flex items-center justify-center gap-3">
                    تحديث البيانات ⟳
                </button>
            </div>

            {loading ? (
              <div className="text-center py-32 text-gray-300 font-black text-xl animate-pulse italic">جاري جلب سجلات التدفق المالي...</div>
            ) : (
                <>
                    {/* ملخصات العملات المنفصلة */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                        {Object.entries(summaryGrouped).map(([curr, totals]: any) => (
                            <div key={curr} className="bg-white border-2 border-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl transform hover:-translate-y-2 transition-all duration-500">
                                <div className="bg-slate-900 text-white p-5 text-center font-black text-sm flex justify-center items-center gap-3">
                                    <span className="text-2xl">🏛️</span>
                                    <span>رصيد الـ {getCurrencyName(curr)}</span>
                                </div>
                                <div className="p-8 space-y-5">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-gray-400 uppercase tracking-widest">إجمالي الوارد:</span>
                                        <span className="text-green-600 font-black">+{totals.in.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-gray-400 uppercase tracking-widest">إجمالي الصادر:</span>
                                        <span className="text-red-600 font-black">-{totals.out.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-50 pt-5 mt-3">
                                        <span className="font-black text-slate-800 uppercase text-[10px]">الصافي النهائي:</span>
                                        <span className="text-3xl font-black text-slate-900 tracking-tighter">{totals.balance.toLocaleString()} <small className="text-[10px] text-gray-400 font-normal">{curr}</small></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
                        <table className="w-full text-sm text-right border-collapse bg-white">
                            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] tracking-widest">
                                <tr>
                                    <th className="p-6 border-b border-slate-100">تاريخ السند</th>
                                    <th className="p-6 border-b border-slate-100">نوع الحركة</th>
                                    <th className="p-6 border-b border-slate-100">البيان والتفاصيل</th>
                                    <th className="p-6 border-b border-slate-100 text-center">العملة</th>
                                    <th className="p-6 border-b border-slate-100 text-green-700 bg-green-50/20">وارد (+)</th>
                                    <th className="p-6 border-b border-slate-100 text-red-700 bg-red-50/20">صادر (-)</th>
                                    <th className="p-6 border-b border-slate-100 text-slate-300 font-normal">المستلم</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {ledger.map((row: any) => (
                                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-6 whitespace-nowrap text-gray-400 font-mono text-xs">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-6 font-black text-xs">
                                            <span className={`px-4 py-2 rounded-2xl shadow-sm ${row.type.includes('وارد') || row.type.includes('قبض') ? 'bg-green-100 text-green-700 shadow-green-100' : 'bg-red-100 text-red-700 shadow-red-100'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="p-6 text-slate-700 font-black max-w-[300px] truncate">{row.description}</td>
                                        <td className="p-6 text-center font-black text-blue-600 text-xl tracking-tighter">{row.currency}</td>
                                        <td className="p-6 font-black text-2xl text-green-700 bg-green-50/5">{row.inAmount > 0 ? row.inAmount.toLocaleString() : '-'}</td>
                                        <td className="p-6 font-black text-2xl text-red-700 bg-red-50/5">{row.outAmount > 0 ? row.outAmount.toLocaleString() : '-'}</td>
                                        <td className="p-6 text-xs text-slate-300 font-mono italic">{row.user}</td>
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

    if (loading) return <div className="text-center py-40 font-black text-slate-300 text-2xl animate-pulse italic">جاري تحليل كفاءة فريق المبيعات...</div>;

    return (
        <div className="space-y-12 animate-in zoom-in-95 duration-700">
            <div className="flex justify-between items-center border-b border-slate-50 pb-8">
                <h2 className="text-3xl font-black text-slate-700 tracking-tight">تقرير تقييم الكفاءة والإنتاجية</h2>
                <span className="bg-purple-100 text-purple-700 px-6 py-2 rounded-full text-xs font-black uppercase shadow-lg shadow-purple-50 tracking-[0.3em]">LIVE STATS</span>
            </div>
            
            <div className="overflow-x-auto rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 bg-white">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-purple-600 text-white font-black uppercase text-[10px] tracking-widest">
                        <tr>
                            <th className="p-8">اسم الموظف</th>
                            <th className="p-8 text-purple-200">كود الدخول</th>
                            <th className="p-8 cursor-pointer hover:bg-purple-700 transition-all" onClick={() => handleSort('orderCount')}>
                                عدد الأوردرات {sortConfig?.key === 'orderCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-8 cursor-pointer hover:bg-purple-700 transition-all" onClick={() => handleSort('totalSales')}>
                                إجمالي المبيعات {sortConfig?.key === 'totalSales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-8 cursor-pointer hover:bg-purple-700 transition-all" onClick={() => handleSort('totalDiscount')}>
                                الخصومات الممنوحة {sortConfig?.key === 'totalDiscount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sortedData.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-purple-50 transition-all group border-b last:border-0">
                                <td className="p-8 font-black text-slate-900 text-2xl group-hover:text-purple-700 transition-colors">{emp.name}</td>
                                <td className="p-8 font-mono text-slate-300 text-xs tracking-tighter">{emp.code}</td>
                                <td className="p-8 text-center font-black text-4xl text-slate-800 tracking-tighter">{emp.orderCount}</td>
                                <td className="p-8 font-black text-green-700 text-3xl tracking-tighter">
                                    {emp.totalSales.toLocaleString()} <small className="text-xs font-normal">ج.م</small>
                                </td>
                                <td className="p-8 font-black text-red-600 text-2xl tracking-tighter">
                                    {emp.totalDiscount.toLocaleString()} <small className="text-xs font-normal">ج.م</small>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}