'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { getBazaarReport } from '@/app/bazaar-actions'

export default function BazaarReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const res = await getBazaarReport(startDate, endDate)
    if (res.success && res.data) {
      setReportData(res.data)
    } else {
      alert(res.error || 'فشل جلب بيانات تقرير البازار')
    }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // تصدير التقرير لإكسيل
  const handleExportExcel = () => {
    if (!reportData) return

    const wb = XLSX.utils.book_new()

    // ورقة مبيعات الموظفين
    const empData = reportData.employeesSummary.map((emp: any) => {
      const safesStr = Object.entries(emp.safesCollected)
        .map(([safe, amt]) => `${safe}: ${amt}`)
        .join(' | ')

      return {
        'اسم الموظف': emp.name,
        'كود الموظف': emp.code,
        'عدد الأوردرات': emp.ordersCount,
        'عدد القطع': emp.piecesCount,
        'إجمالي المبيعات (ج.م)': emp.totalSales,
        'تفصيل التحصيل بالخزن': safesStr
      }
    })
    const wsEmp = XLSX.utils.json_to_sheet(empData)
    XLSX.utils.book_append_sheet(wb, wsEmp, 'الموظفين')

    // ورقة الخزن
    const safesData = reportData.safesSummary.map((s: any) => {
      const empStr = Object.entries(s.byEmployee)
        .map(([emp, amt]) => `${emp}: ${amt}`)
        .join(' | ')

      return {
        'اسم الخزنة': s.safeName,
        'المقبوضات': s.totalIn,
        'المرتجعات/المسحوبات': s.totalOut,
        'الصافي (ج.م)': s.net,
        'المحصلون بالخزنة': empStr
      }
    })
    const wsSafes = XLSX.utils.json_to_sheet(safesData)
    XLSX.utils.book_append_sheet(wb, wsSafes, 'الخزن والنقدية')

    // ورقة الأوردرات
    const ordersData = reportData.orders.map((o: any) => ({
      'رقم الأوردر': o.orderNo,
      'التاريخ والوقت': new Date(o.createdAt).toLocaleString('ar-EG'),
      'الموظف': o.employeeName,
      'عدد القطع': o.piecesCount,
      'المبلغ (ج.م)': o.totalAmount,
      'الأصناف': o.itemsDetails,
      'ملاحظات': o.notes
    }))
    const wsOrders = XLSX.utils.json_to_sheet(ordersData)
    XLSX.utils.book_append_sheet(wb, wsOrders, 'سجل الفواتير')

    XLSX.writeFile(wb, `Bazaar_Report_${startDate}_to_${endDate}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      
      {/* طباعة الهيدر للشاشة وتنسيق الطباعة */}
      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-content { padding: 0 !important; }
          .bg-slate-900, .bg-slate-800, .bg-slate-950 { background: white !important; color: black !important; border-color: #ddd !important; }
          .text-white, .text-slate-300, .text-slate-400 { color: black !important; }
        }
      `}</style>

      {/* الهيدر العلوي */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl mb-6 no-print">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎪</span>
            <h1 className="text-2xl md:text-3xl font-black text-white">تقرير مبيعات وخزن البازار</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            متابعة دقيقة لمبيعات كل موظف وتفصيل النقدية المسلمة في كل خزنة (كاش، فودافون كاش، انستا باي)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => window.print()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2"
          >
            <span>🖨️</span>
            <span>طباعة</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
          >
            <span>📊</span>
            <span>تصدير Excel</span>
          </button>

          <Link
            href="/admin/reports"
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
          >
            ← التقارير
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 print-content">

        {/* شريط فلتر التاريخ */}
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg flex flex-wrap justify-between items-center gap-4 no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-slate-300">📅 الفترة الزمنية:</span>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">من:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-bold outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">إلى:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-bold outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={fetchReport}
              className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-md"
            >
              تحديث التقرير ⟳
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {startDate === endDate ? `تقرير يوم: ${startDate}` : `من ${startDate} إلى ${endDate}`}
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold text-lg animate-pulse">
            جاري جمع وتحليل بيانات مبيعات وخزن البازار...
          </div>
        ) : !reportData ? (
          <div className="p-16 text-center text-red-400 font-bold">
            حدث خطأ أثناء تحميل البيانات
          </div>
        ) : (
          <>
            {/* 1. كروت الملخص الإجمالي */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg">
                <span className="text-xs text-slate-400 block mb-1">إجمالي مبيعات البازار</span>
                <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
                  {reportData.summary.totalSalesAmount.toLocaleString()} <small className="text-xs text-slate-400">ج.م</small>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">{reportData.summary.totalOrdersCount} فاتورة منفذة</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg">
                <span className="text-xs text-slate-400 block mb-1">إجمالي القطع المباعة</span>
                <span className="text-2xl md:text-3xl font-black text-blue-400 font-mono">
                  {reportData.summary.totalPiecesCount.toLocaleString()} <small className="text-xs text-slate-400">قطعة</small>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">حجم البضاعة المبيعة</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg">
                <span className="text-xs text-slate-400 block mb-1">المقبوضات النقدية</span>
                <span className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">
                  {reportData.summary.totalCashIn.toLocaleString()} <small className="text-xs text-slate-400">ج.م</small>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">داخل الخزن والمحافظ</span>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg">
                <span className="text-xs text-slate-400 block mb-1">صافي النقدية المسلمة بالدرج</span>
                <span className="text-2xl md:text-3xl font-black text-white font-mono">
                  {reportData.summary.netCash.toLocaleString()} <small className="text-xs text-slate-400">ج.م</small>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">بعد استقطاع المرتجعات</span>
              </div>

            </div>

            {/* 2. جدول مبيعات البازار حسب الموظف وتفصيل الخزن */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>👨‍💼</span>
                  <span>مبيعات البازار حسب الموظف والتحصيل بالخزن</span>
                </h2>
                <span className="text-xs text-slate-400">عدد الموظفين المشاركين: {reportData.employeesSummary.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-900 text-slate-300 text-xs font-bold uppercase border-b border-slate-700">
                    <tr>
                      <th className="p-3.5">الموظف</th>
                      <th className="p-3.5">الكود</th>
                      <th className="p-3.5 text-center">عدد الأوردرات</th>
                      <th className="p-3.5 text-center">القطع المباعة</th>
                      <th className="p-3.5 text-center">إجمالي المبيعات</th>
                      <th className="p-3.5">تفصيل النقدية المسلمة حسب الخزنة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {reportData.employeesSummary.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          لا توجد مبيعات في الفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      reportData.employeesSummary.map((emp: any) => (
                        <tr key={emp.userId} className="hover:bg-slate-700/30 transition">
                          <td className="p-3.5 font-bold text-white text-base">
                            {emp.name}
                          </td>
                          <td className="p-3.5 font-mono text-xs text-slate-400">
                            {emp.code}
                          </td>
                          <td className="p-3.5 text-center font-bold font-mono text-amber-400 text-base">
                            {emp.ordersCount}
                          </td>
                          <td className="p-3.5 text-center font-bold font-mono text-blue-400 text-base">
                            {emp.piecesCount}
                          </td>
                          <td className="p-3.5 text-center font-black font-mono text-emerald-400 text-lg">
                            {emp.totalSales.toLocaleString()} ج.م
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(emp.safesCollected).map(([safe, amt]: any) => (
                                <span
                                  key={safe}
                                  className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold"
                                >
                                  <span className="text-slate-300">{safe}:</span>
                                  <span className="text-amber-400 font-mono">{amt.toLocaleString()} ج.م</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. كشف النقدية المسلمة بالخزنة بالتفصيل (عشان لو باع فودافون كاش أو انستا باي) */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🏦</span>
                  <span>تفصيل النقدية المسلمة بالخزنة ومَن قام بالتحصيل</span>
                </h2>
                <span className="text-xs text-amber-400 font-bold">مراجعة الدرج والمحافظ الإلكترونية</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                {reportData.safesSummary.length === 0 ? (
                  <div className="col-span-full text-center text-slate-400 py-6">
                    لا توجد حركات نقدية مسجلة للبازار في هذه الفترة
                  </div>
                ) : (
                  reportData.safesSummary.map((s: any) => (
                    <div
                      key={s.safeName}
                      className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md space-y-4"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs text-slate-400 block">الخزنة / المحفظة</span>
                          <h3 className="text-lg font-black text-white">{s.safeName}</h3>
                        </div>
                        <div className="text-left">
                          <span className="text-xs text-slate-400 block">صافي النقدية</span>
                          <span className="text-xl font-black text-emerald-400 font-mono">
                            {s.net.toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>إجمالي المقبوضات:</span>
                          <span className="text-emerald-400 font-bold font-mono">+{s.totalIn.toLocaleString()} ج.م</span>
                        </div>
                        {s.totalOut > 0 && (
                          <div className="flex justify-between text-slate-400">
                            <span>المرتجعات/المسحوبات:</span>
                            <span className="text-red-400 font-bold font-mono">-{s.totalOut.toLocaleString()} ج.م</span>
                          </div>
                        )}
                      </div>

                      {/* تفصيل الموظفين في هذه الخزنة */}
                      <div className="pt-3 border-t border-slate-800/80">
                        <span className="text-[11px] font-bold text-slate-400 block mb-2">المحصلون في هذه الخزنة:</span>
                        <div className="space-y-1">
                          {Object.entries(s.byEmployee).map(([empName, amt]: any) => (
                            <div key={empName} className="flex justify-between items-center text-xs bg-slate-900/60 p-1.5 rounded-lg">
                              <span className="text-slate-300 font-medium">{empName}</span>
                              <span className="text-amber-400 font-bold font-mono">{amt.toLocaleString()} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. سجل فواتير البازار التفصيلي */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🧾</span>
                  <span>سجل فواتير البازار المنفذة</span>
                </h2>
                <span className="text-xs text-slate-400">إجمالي: {reportData.orders.length} فاتورة</span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-900 text-slate-300 text-xs font-bold uppercase sticky top-0 border-b border-slate-700">
                    <tr>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">الوقت والتاريخ</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3 text-center">القطع</th>
                      <th className="p-3 text-center">القيمة</th>
                      <th className="p-3">الأصناف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {reportData.orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-700/30 transition">
                        <td className="p-3 font-mono font-bold text-amber-400">
                          #{o.orderNo}
                        </td>
                        <td className="p-3 text-xs text-slate-400 font-mono">
                          {new Date(o.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} - {new Date(o.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-3 font-bold text-white">
                          {o.employeeName}
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-blue-400">
                          {o.piecesCount}
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-emerald-400">
                          {o.totalAmount.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 text-xs text-slate-400 truncate max-w-xs">
                          {o.itemsDetails}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}

      </div>

    </div>
  )
}