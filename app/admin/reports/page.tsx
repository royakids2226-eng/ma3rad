'use client'
import { useState, useEffect, useCallback } from 'react';
import { getInventoryReport, getSafesList, getSafeLedger, getEmployeePerformance } from '@/app/report-actions';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'SAFE' | 'EMPLOYEES'>('INVENTORY');
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      {/* ========================================================================
          HEADER SECTION - يحتوي على العنوان وأزرار التحكم الرئيسية
          ======================================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Step 9-4 4-4 4 4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800">التقارير والإحصائيات المركزية</h1>
            <p className="text-gray-400 text-xs mt-1 font-bold">لوحة تحكم شاملة لمراقبة الأداء المالي والمخزني</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => window.print()} 
              className="flex-1 md:flex-none bg-slate-900 text-white px-8 py-3 rounded-xl font-black shadow-xl hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-2 print:hidden"
            >
                <span>🖨️</span>
                <span>طباعة التقرير</span>
            </button>
        </div>
      </div>

      {/* ========================================================================
          TABS NAVIGATION - التنقل بين الأقسام المختلفة
          ======================================================================== */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 print:hidden overflow-x-auto pb-2 scrollbar-hide">
        <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-8 py-4 font-black whitespace-nowrap transition-all rounded-t-2xl flex items-center gap-2 ${activeTab === 'INVENTORY' ? 'bg-white border-t-4 border-blue-600 text-blue-700 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-xl">📦</span>
            حركة الأصناف والمخزون
        </button>
        <button 
            onClick={() => setActiveTab('SAFE')}
            className={`px-8 py-4 font-black whitespace-nowrap transition-all rounded-t-2xl flex items-center gap-2 ${activeTab === 'SAFE' ? 'bg-white border-t-4 border-green-600 text-green-700 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-xl">💰</span>
            دفتر أستاذ الخزينة
        </button>
        <button 
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-8 py-4 font-black whitespace-nowrap transition-all rounded-t-2xl flex items-center gap-2 ${activeTab === 'EMPLOYEES' ? 'bg-white border-t-4 border-purple-600 text-purple-700 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' : 'bg-transparent text-gray-400 hover:text-gray-600'}`}
        >
            <span className="text-xl">👥</span>
            أداء مبيعات الموظفين
        </button>
      </div>

      {/* ========================================================================
          MAIN CONTENT AREA - المساحة المخصصة لعرض التقرير المختار
          ======================================================================== */}
      <div className="bg-white p-4 md:p-8 rounded-3xl shadow-sm min-h-[600px] border border-gray-50 relative overflow-hidden">
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
    
    // خيارات العرض والترتيب
    const [viewMode, setViewMode] = useState<'COLOR' | 'MODEL'>('COLOR');
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

    // تجميع البيانات بالموديل لتقارير الجملة
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

    // إضافة نسبة المبيع التفاعلية
    displayData = displayData.map((item: any) => ({
        ...item,
        salesPercentage: item.initialStock > 0 ? (item.totalSold / item.initialStock) * 100 : 0
    }));

    // الترتيب الأبجدي والرقمي
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
                : `موديل ${item.modelNo} (كافة الألوان)`;
            setSelectedItemName(name);
            const sortedHistory = [...item.history].sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setSelectedHistory(sortedHistory);
        }
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center py-40 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="font-black text-gray-400">جاري تحليل بيانات المخزون...</div>
        </div>
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-700">تقرير حركة الأصناف التفصيلي</h2>
                    <p className="text-xs text-blue-500 font-bold mt-1">يتم احتساب المبيعات بوحدة (الدرزن/الثرية) والمخزن بوحدة (القطعة)</p>
                </div>
                <div className="bg-gray-100 p-1.5 rounded-2xl flex text-xs shadow-inner print:hidden">
                    <button 
                        onClick={() => { setViewMode('COLOR'); setSortConfig(null); }} 
                        className={`px-8 py-2.5 rounded-xl transition-all ${viewMode === 'COLOR' ? 'bg-white shadow-lg text-blue-700 font-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        تفصيلي (باللون)
                    </button>
                    <button 
                        onClick={() => { setViewMode('MODEL'); setSortConfig(null); }} 
                        className={`px-8 py-2.5 rounded-xl transition-all ${viewMode === 'MODEL' ? 'bg-white shadow-lg text-blue-700 font-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        تجميعي (بالموديل)
                    </button>
                </div>
            </div>
            
            {/* ملخص الإحصائيات الذكية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 text-blue-100/50 text-6xl group-hover:scale-110 transition-transform">🏷️</div>
                    <div className="text-blue-400 text-[10px] font-black uppercase mb-1 tracking-widest">عدد الموديلات</div>
                    <div className="text-3xl font-black text-blue-700">{viewMode === 'MODEL' ? displayData.length : summary.totalItems}</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 text-indigo-100/50 text-6xl group-hover:scale-110 transition-transform">📦</div>
                    <div className="text-indigo-400 text-[10px] font-black uppercase mb-1 tracking-widest">الرصيد الحالي (قطعة)</div>
                    <div className="text-3xl font-black text-indigo-700">{summary.totalCurrentStock}</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-3xl border border-yellow-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 text-yellow-100/50 text-6xl group-hover:scale-110 transition-transform">📉</div>
                    <div className="text-yellow-600 text-[10px] font-black uppercase mb-1 tracking-widest">إجمالي المباع (قطعة)</div>
                    <div className="text-3xl font-black text-yellow-700">{summary.totalSoldUnits}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-3xl border border-orange-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 text-orange-100/50 text-6xl group-hover:scale-110 transition-transform">💰</div>
                    <div className="text-orange-400 text-[10px] font-black uppercase mb-1 tracking-widest">إجمالي المبيعات</div>
                    <div className="text-2xl font-black text-orange-700">{summary.totalSalesValue?.toLocaleString()} ج.م</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-3xl border border-green-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 text-green-100/50 text-6xl group-hover:scale-110 transition-transform">💎</div>
                    <div className="text-green-400 text-[10px] font-black uppercase mb-1 tracking-widest">قيمة المخزون</div>
                    <div className="text-2xl font-black text-green-700">{summary.totalValue?.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* الجدول الرئيسي */}
            <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                        <tr>
                            <th className="p-5 border-b">كود الموديل</th>
                            <th className="p-5 border-b">{viewMode === 'COLOR' ? 'اللون' : 'الألوان المتاحة'}</th>
                            <th className="p-5 border-b bg-blue-50/30 text-blue-700">الرصيد الأولي (قطعة)</th>
                            <th className="p-5 border-b bg-yellow-50/30 text-yellow-700">المبيعات (قطعة)</th>
                            <th className="p-5 border-b bg-green-50/30 text-green-700">الرصيد الحالي (قطعة)</th>
                            <th className="p-5 border-b cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('salesPercentage')}>
                                نسبة المبيع {sortConfig?.key === 'salesPercentage' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-5 border-b">الحالة</th>
                            <th className="p-5 border-b">القيمة السوقية</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {displayData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-5 font-black text-gray-900 text-lg group-hover:text-blue-600 transition-colors">{item.modelNo}</td>
                                <td className="p-5 text-gray-500 font-medium italic">
                                    {viewMode === 'COLOR' ? item.color : <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-400 font-normal">{item.colors.join('، ')}</span>}
                                </td>
                                <td className="p-5 font-bold text-blue-700 bg-blue-50/10">{item.initialStock}</td>
                                <td className="p-5">
                                    {item.totalSold > 0 ? (
                                        <button 
                                          onClick={() => openHistory(item)} 
                                          className="bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-xl font-black hover:bg-yellow-600 hover:text-white transition-all shadow-sm"
                                        >
                                            {item.totalSold} <small className="text-[9px] font-normal mr-1">تحليل</small>
                                        </button>
                                    ) : (
                                        <span className="text-gray-300 font-bold">0</span>
                                    )}
                                </td>
                                <td className={`p-5 font-black text-lg ${item.currentStock <= 0 ? 'text-red-600 bg-red-50/30 animate-pulse' : 'text-green-700 bg-green-50/10'}`}>
                                    {item.currentStock}
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-16 hidden sm:block border border-gray-200">
                                            <div 
                                              className={`h-full rounded-full transition-all duration-1000 ease-out ${item.salesPercentage > 70 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : item.salesPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                              style={{ width: `${Math.min(item.salesPercentage, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="font-black text-xs text-gray-700">{item.salesPercentage.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="p-5">
                                    {item.status === 'OPEN' ? (
                                        <span className="text-[10px] bg-green-600 text-white px-3 py-1 rounded-full font-black shadow-lg shadow-green-100 uppercase">متاح</span>
                                    ) : (
                                        <span className="text-[10px] bg-red-600 text-white px-3 py-1 rounded-full font-black shadow-lg shadow-red-100 uppercase">مغلق</span>
                                    )}
                                </td>
                                <td className="p-5 font-mono font-bold text-gray-400">
                                    {item.currentValue.toLocaleString()} <span className="text-[9px]">ج.م</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال تفاصيل تاريخ المبيعات - النسخة الأصلية المطورة */}
            {selectedHistory && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex justify-center items-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute right-0 top-0 opacity-10 text-9xl">📈</div>
                            <div className="relative z-10">
                                <h3 className="font-black text-2xl tracking-tight">سجل حركة مبيعات الصنف</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="bg-blue-600 px-3 py-0.5 rounded-lg text-xs font-bold">{selectedItemName}</span>
                                    <span className="text-slate-400 text-xs font-medium">عرض كافة الأوردرات المرتبطة</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedHistory(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-2xl">✕</button>
                        </div>
                        <div className="p-8 max-h-[55vh] overflow-y-auto">
                            <table className="w-full text-sm text-right border-collapse">
                                <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b">تاريخ البيع</th>
                                        <th className="p-4 border-b">رقم الفاتورة</th>
                                        <th className="p-4 border-b">العميل المستلم</th>
                                        <th className="p-4 border-b text-center">الكمية المباعة (قطعة)</th>
                                        <th className="p-4 border-b text-left">سعر الوحدة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedHistory.map((h: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-4 text-gray-500 font-mono text-xs">{new Date(h.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td className="p-4 font-black text-blue-600 group-hover:translate-x-1 transition-transform inline-block">#{h.orderNo}</td>
                                            <td className="p-4 font-bold text-gray-700">{h.customer}</td>
                                            <td className="p-4 text-center font-black text-xl text-slate-800">{h.quantity}</td>
                                            <td className="p-4 text-left font-mono font-black text-green-600">{h.price} <small className="text-[10px]">ج.م</small></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {selectedHistory.length === 0 && (
                                <div className="text-center py-20 text-gray-300 font-bold">لا يوجد سجل تاريخي لهذا الصنف</div>
                            )}
                        </div>
                        <div className="bg-gray-50 p-8 text-center border-t border-gray-100">
                            <button 
                              onClick={() => setSelectedHistory(null)} 
                              className="bg-slate-900 text-white px-20 py-4 rounded-2xl font-black shadow-2xl shadow-gray-300 hover:scale-105 transition-all"
                            >
                                إغلاق سجل المراجعة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ===============================================
// 2. مكون دفتر الخزينة
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
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl font-black text-gray-700 border-b pb-4">دفتر الأستاذ الموحد للخزينة</h2>
            
            <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-8 rounded-3xl border border-gray-100 shadow-inner print:hidden">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-xs font-black mb-2.5 text-slate-500 uppercase tracking-widest">اختر الخزنة للمراجعة</label>
                    <select value={selectedSafe} onChange={e => setSelectedSafe(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 font-bold">
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-black mb-2.5 text-slate-500">بداية الفترة</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm font-bold" />
                </div>
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-black mb-2.5 text-slate-500">نهاية الفترة</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm font-bold" />
                </div>
                <button onClick={fetchLedgerData} className="w-full sm:w-auto bg-green-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-105 transition-all flex items-center justify-center gap-2">
                    تحديث السجلات ⟳
                </button>
            </div>

            {loading ? (
              <div className="text-center py-32 text-gray-300 font-black animate-pulse">جاري جلب حركات التدفق النقدي...</div>
            ) : (
                <>
                    {/* 👇 ملخصات العملات المنفصلة (كما في صورتك) 👇 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
                        {Object.entries(summaryGrouped).map(([curr, totals]: any) => (
                            <div key={curr} className="bg-white border-2 border-slate-900 rounded-[2rem] overflow-hidden shadow-xl transform hover:-translate-y-2 transition-all duration-500">
                                <div className="bg-slate-900 text-white p-4 text-center font-black text-sm flex justify-center items-center gap-3">
                                    <span className="text-xl">🏛️</span>
                                    <span>رصيد الـ {getCurrencyName(curr)}</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-gray-400 uppercase">مجموع الوارد:</span>
                                        <span className="text-green-600 font-black">+{totals.in.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-gray-400 uppercase">مجموع الصادر:</span>
                                        <span className="text-red-600 font-black">-{totals.out.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                                        <span className="font-black text-slate-800 uppercase text-[10px]">الصافي النهائي:</span>
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{totals.balance.toLocaleString()} <small className="text-[10px] text-gray-400 font-normal">{curr}</small></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto rounded-[2rem] border border-gray-100 shadow-lg">
                        <table className="w-full text-sm text-right border-collapse bg-white">
                            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-tighter">
                                <tr>
                                    <th className="p-5 border-b">تاريخ الحركة</th>
                                    <th className="p-5 border-b">نوع السند</th>
                                    <th className="p-5 border-b">البيان والشرح</th>
                                    <th className="p-5 border-b text-center">العملة</th>
                                    <th className="p-5 border-b text-green-700 bg-green-50/20">وارد (+)</th>
                                    <th className="p-5 border-b text-red-700 bg-red-50/20">صادر (-)</th>
                                    <th className="p-5 border-b text-slate-300 font-normal">المستلم</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {ledger.map((row: any) => (
                                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-5 whitespace-nowrap text-gray-400 font-mono text-xs">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-5 font-black text-xs">
                                            <span className={`px-3 py-1.5 rounded-xl ${row.type.includes('وارد') || row.type.includes('قبض') ? 'bg-green-100 text-green-700 shadow-sm shadow-green-100' : 'bg-red-100 text-red-700 shadow-sm shadow-red-100'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="p-5 text-slate-700 font-bold max-w-[250px] truncate">{row.description}</td>
                                        <td className="p-5 text-center font-black text-blue-600 text-lg">{row.currency}</td>
                                        <td className="p-5 font-black text-green-700 text-lg bg-green-50/5">{row.inAmount > 0 ? row.inAmount.toLocaleString() : '-'}</td>
                                        <td className="p-5 font-black text-red-700 text-lg bg-red-50/5">{row.outAmount > 0 ? row.outAmount.toLocaleString() : '-'}</td>
                                        <td className="p-5 text-xs text-slate-300 font-mono italic">{row.user}</td>
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
// 3. مكون تقرير أداء الموظفين
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

    if (loading) return <div className="text-center py-40 font-black text-slate-300 animate-pulse">جاري تحليل كفاءة المبيعات...</div>;

    return (
        <div className="space-y-10 animate-in zoom-in-95 duration-700">
            <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                <h2 className="text-2xl font-black text-slate-700 tracking-tight">تقرير تقييم أداء فريق المبيعات</h2>
                <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase">إحصائيات مباشرة</span>
            </div>
            
            <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-100">
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-purple-600 text-white font-black uppercase text-[10px] tracking-widest">
                        <tr>
                            <th className="p-6">اسم الموظف</th>
                            <th className="p-6 text-purple-200">كود الدخول</th>
                            <th className="p-6 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('orderCount')}>
                                عدد الأوردرات {sortConfig?.key === 'orderCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-6 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('totalSales')}>
                                إجمالي المبيعات {sortConfig?.key === 'totalSales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-6 cursor-pointer hover:bg-purple-700 transition-colors" onClick={() => handleSort('totalDiscount')}>
                                الخصومات الممنوحة {sortConfig?.key === 'totalDiscount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {sortedData.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-purple-50/50 transition-all group">
                                <td className="p-6 font-black text-slate-900 text-xl group-hover:text-purple-700 transition-colors">{emp.name}</td>
                                <td className="p-6 font-mono text-slate-300 text-xs">{emp.code}</td>
                                <td className="p-6 text-center font-black text-2xl text-slate-800">{emp.orderCount}</td>
                                <td className="p-6 font-black text-green-700 text-2xl tracking-tighter">
                                    {emp.totalSales.toLocaleString()} <small className="text-[10px] font-normal">ج.م</small>
                                </td>
                                <td className="p-6 font-bold text-red-600 text-lg">
                                    {emp.totalDiscount.toLocaleString()} <small className="text-[10px] font-normal">ج.م</small>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}