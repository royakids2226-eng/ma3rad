'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getVendors, addVendor } from '@/app/vendor-actions'
import { getSafesList } from '@/app/report-actions'
import { 
  createPurchaseInvoice, 
  searchProductsForPurchase, 
  getModelColors,
  fetchAllProductsForCache
} from '@/app/purchase-actions'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { 
    getCachedVendors, 
    cacheVendors, 
    getCachedProducts, 
    cacheProducts, 
    getUnsyncedReturns, 
    saveReturnForSync,
    updateUnsyncedReturn,
    removeReturnFromSyncQueue
} from '@/lib/offline'

interface InvoiceRow {
  id: string
  modelNo: string
  color: string
  quantity: number | string
  cost: number | string
  price: number | string
  description?: string
  currentStock?: number
}

const DRAFT_STORAGE_KEY = 'purchase_return_draft_v2'

export default function NewPurchaseReturnInvoicePage() {
  const router = useRouter()

  // الاتصال بالإنترنت والمزامنة المحلية
  const [isOnline, setIsOnline] = useState(true)
  const [unsyncedReturns, setUnsyncedReturns] = useState<any[]>([])

  // إعدادات الفاتورة
  const invoiceType = 'RETURN' as const
  const [paymentStatus, setPaymentStatus] = useState<'CREDIT' | 'CASH'>('CREDIT')
  const [invoiceNo, setInvoiceNo] = useState(`RET-${Date.now().toString().slice(-6)}`)
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // الخزن والموردين
  const [safes, setSafes] = useState<any[]>([])
  const [selectedSafeId, setSelectedSafeId] = useState('')
  const [vendors, setVendors] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  
  // المورد الافتراضي "رؤية"
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const vendorRef = useRef<HTMLDivElement>(null)

  // بنود المرتجع (الكروت)
  const [rows, setRows] = useState<InvoiceRow[]>([])

  // مودال الكاميرا والبحث اليدوي
  const [showScanner, setShowScanner] = useState(false)
  const [manualSearch, setManualSearch] = useState('')
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([])
  const [isSearchingManual, setIsSearchingManual] = useState(false)

  // مودال تعديل الصنف بالكامل
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [availableColorsForEdit, setAvailableColorsForEdit] = useState<any[]>([])

  // مؤشرات التحميل والإشعارات
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'warn' } | null>(null)

  // مراجع عناصر الإدخال والأزرار
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // مراجع لحماية الـ Back والـ Popstate
  const rowsRef = useRef(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])

  const showScannerRef = useRef(showScanner)
  useEffect(() => { showScannerRef.current = showScanner }, [showScanner])

  const editingRowIndexRef = useRef(editingRowIndex)
  useEffect(() => { editingRowIndexRef.current = editingRowIndex }, [editingRowIndex])

  const historyTrappedRef = useRef(false)

  // دالة مساعدة لضبط المورد "رؤية" افتراضياً
  const applyDefaultRoyaVendor = (vendorsList: any[]) => {
    if (!vendorsList || vendorsList.length === 0) return
    const roya = vendorsList.find((v: any) => v.name?.trim() === 'رؤية') || 
                 vendorsList.find((v: any) => v.name?.includes('رؤية'))
    if (roya) {
      setSelectedVendor(roya)
      setVendorSearch(roya.name)
    }
  }

  // =========================================================================
  // 1. حماية زر الرجوع (Back Button Interception) وتجنب الخروج غير المقصود
  // =========================================================================
  useEffect(() => {
    const hasUnsaved = rows.length > 0
    if (hasUnsaved && !historyTrappedRef.current) {
      window.history.pushState({ page: 'return-active' }, '', window.location.href)
      historyTrappedRef.current = true
    } else if (!hasUnsaved) {
      historyTrappedRef.current = false
    }
  }, [rows.length])

  useEffect(() => {
    let isLeavingConfirmed = false

    const handlePopState = (e: PopStateEvent) => {
      // أ) إذا كان سكانر الكاميرا مفتوحاً: اغلق الكاميرا فقط ولا تخرج من الفاتورة
      if (showScannerRef.current) {
        setShowScanner(false)
        return
      }

      // ب) إذا كان مودال تغيير اللون مفتوحاً: اغلقه فقط
      if (editingRowIndexRef.current !== null) {
        setEditingRowIndex(null)
        return
      }

      // ج) إذا كان هناك أصناف في الفاتورة
      if (rowsRef.current.length > 0 && !isLeavingConfirmed) {
        const confirmLeave = window.confirm(
          '⚠️ تنبيه: لديك أصناف في فاتورة المرتجع الحالية لم يتم حفظها بعد!\n\nهل أنت متأكد من الخروج وإلغاء المسودة؟'
        )

        if (confirmLeave) {
          isLeavingConfirmed = true
          localStorage.removeItem(DRAFT_STORAGE_KEY)
          historyTrappedRef.current = false
          router.push('/')
        } else {
          // منع الخروج وإعادة تثبيت الصفحة
          window.history.pushState({ page: 'return-active' }, '', window.location.href)
        }
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (rowsRef.current.length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [router])

  // دالة الخروج اليدوي من زر الهيدر
  const handleExitClick = () => {
    if (rows.length > 0) {
      if (confirm('⚠️ تنبيه: لديك أصناف في فاتورة المرتجع الحالية.\n\nهل تريد الخروج وإلغاء المسودة؟')) {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
        historyTrappedRef.current = false
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }

  // =========================================================================
  // 2. الحفظ التلقائي للمسودة (Auto-Save Draft)
  // =========================================================================
  // حفظ التغييرات في الذاكرة المحلية تلقائياً
  useEffect(() => {
    if (rows.length > 0) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          rows,
          notes,
          invoiceNo,
          paymentStatus,
          vendorId: selectedVendor?.id
        }))
      } catch (e) {}
    }
  }, [rows, notes, invoiceNo, paymentStatus, selectedVendor])

  // التحميل الأولي واسترجاع المسودة إن وجدت
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    loadInitialData()
    setUnsyncedReturns(getUnsyncedReturns())

    // محاولة استرجاع المسودة المحفوظة
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)
        if (parsed.rows && parsed.rows.length > 0) {
          setRows(parsed.rows)
          if (parsed.notes) setNotes(parsed.notes)
          if (parsed.invoiceNo) setInvoiceNo(parsed.invoiceNo)
          if (parsed.paymentStatus) setPaymentStatus(parsed.paymentStatus)
          setNotice({
            text: `تم استرجاع مسودة المرتجع السابقة (${parsed.rows.length} صنف) تلقائياً لحمايتها من الفقدان!`,
            type: 'success'
          })
          setTimeout(() => setNotice(null), 5000)
        }
      }
    } catch (e) {}

    const handleClickOutside = (e: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // مزامنة تلقائية عند عودة الإنترنت
  useEffect(() => {
    if (isOnline) {
      syncAllReturns()
    }
  }, [isOnline])

  const loadInitialData = async () => {
    if (navigator.onLine) {
      try {
        const [vendorsData, productsData, safesData] = await Promise.all([
          getVendors(),
          fetchAllProductsForCache(),
          getSafesList()
        ])

        setVendors(vendorsData || [])
        cacheVendors(vendorsData || [])
        applyDefaultRoyaVendor(vendorsData || [])

        setAllProducts(productsData || [])
        cacheProducts(productsData || [])

        setSafes(safesData || [])
        if (safesData && safesData.length > 0) {
          const main = safesData.find((s: any) => s.name?.includes('الرئيسية')) || safesData[0]
          setSelectedSafeId(main.id)
        }
      } catch (error) {
        console.error("خطأ أثناء جلب البيانات الحديثة، التحويل للذاكرة المؤقتة:", error)
        loadDataFromCache()
      }
    } else {
      loadDataFromCache()
    }
  }

  const loadDataFromCache = () => {
    const cachedV = getCachedVendors()
    setVendors(cachedV)
    applyDefaultRoyaVendor(cachedV)
    setAllProducts(getCachedProducts())
  }

  // فلترة الموردين
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors
    const q = vendorSearch.toLowerCase()
    return vendors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.code && v.code.toLowerCase().includes(q))
    )
  }, [vendors, vendorSearch])

  // بحث يدوي سريع عن صنف
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!manualSearch.trim()) {
        setManualSearchResults([])
        return
      }
      setIsSearchingManual(true)
      const q = manualSearch.trim().toLowerCase()

      if (isOnline) {
        const res = await searchProductsForPurchase(q)
        setManualSearchResults(res || [])
      } else {
        const filtered = allProducts.filter(p =>
          p.modelNo.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        )
        setManualSearchResults(filtered.slice(0, 15))
      }
      setIsSearchingManual(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [manualSearch, isOnline, allProducts])

  // فتح السكانر مع دفع حالة في الـ History لمنع الخروج إذا ضغط المستخدم Back
  const handleOpenScanner = () => {
    window.history.pushState({ modal: 'scanner' }, '', window.location.href)
    setShowScanner(true)
  }

  // إضافة صنف أو التركيز عليه فوراً بعد المسح أو الاختيار
  const handleSelectProduct = (prod: any) => {
    const rowId = `row-${Date.now()}-${Math.random()}`
    
    // فحص ما إذا كان نفس الصنف موجوداً مسبقاً
    const existingIndex = rows.findIndex(
      r => r.modelNo.toLowerCase() === prod.modelNo.toLowerCase() && r.color === prod.color
    )

    let targetRowId = rowId

    if (existingIndex > -1) {
      targetRowId = rows[existingIndex].id
      setRows(prev => {
        const copy = [...prev]
        const currentQ = Number(copy[existingIndex].quantity) || 0
        copy[existingIndex].quantity = currentQ + 1
        return copy
      })
    } else {
      const newRow: InvoiceRow = {
        id: rowId,
        modelNo: prod.modelNo,
        color: prod.color || 'افتراضي',
        quantity: '', // خالية ليتم إدخال الكمية مباشرة بالكيبورد دون مسح رقم 1
        cost: prod.cost || 0,
        price: prod.price || 0,
        description: prod.description || '',
        currentStock: prod.currentStock ?? 0
      }
      setRows(prev => [newRow, ...prev])
    }

    setManualSearch('')
    setManualSearchResults([])

    // Focus فوري وفتح لوحة الأرقام
    setTimeout(() => {
      const inputEl = qtyInputRefs.current[targetRowId]
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        inputEl.focus()
        inputEl.select()
      }
    }, 150)
  }

  // عند مسح باركود بالكاميرا
  const handleBarcodeScanned = (code: string) => {
    setShowScanner(false)
    if (navigator.vibrate) navigator.vibrate(60)

    const cleanCode = code.trim().toLowerCase()
    const match = allProducts.find(
      p => p.modelNo.toLowerCase() === cleanCode
    )

    if (match) {
      handleSelectProduct(match)
    } else {
      setManualSearch(code.trim())
    }
  }

  // تحديث بيانات الصنف في الكارت
  const updateRow = (index: number, field: keyof InvoiceRow, value: any) => {
    setRows(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const removeRow = (index: number) => {
    setRows(prev => {
      const filtered = prev.filter((_, i) => i !== index)
      if (filtered.length === 0) {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
      }
      return filtered
    })
  }

  // تعديل ألوان الصنف في الكارت
  const openColorPicker = async (index: number) => {
    window.history.pushState({ modal: 'color-picker' }, '', window.location.href)
    setEditingRowIndex(index)
    const row = rows[index]
    let colors = []
    if (isOnline) {
      colors = await getModelColors(row.modelNo)
    } else {
      colors = allProducts.filter(p => p.modelNo.toLowerCase() === row.modelNo.toLowerCase())
    }
    setAvailableColorsForEdit(colors)
  }

  // حساب الإجماليات
  const totalQuantity = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }, [rows])

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => sum + ((Number(r.quantity) || 0) * (Number(r.cost) || 0)), 0)
  }, [rows])

  // حفظ الفاتورة (أونلاين أو أوفلاين)
  const handleSubmitInvoice = async () => {
    if (!selectedVendor) {
      alert('يرجى اختيار المورد أولاً')
      return
    }

    const validItems = rows.filter(r => r.modelNo.trim() !== '' && Number(r.quantity) > 0)
    if (validItems.length === 0) {
      alert('يرجى إدخال صنف واحد على الأقل بكمية أكبر من صفر')
      return
    }

    const payload = {
      vendorId: selectedVendor.id,
      vendorName: selectedVendor.name,
      invoiceType,
      paymentStatus,
      safeId: paymentStatus === 'CASH' ? selectedSafeId : undefined,
      invoiceNo,
      date: invoiceDate,
      notes,
      items: validItems.map(r => ({
        modelNo: r.modelNo.trim(),
        color: r.color.trim() || 'افتراضي',
        quantity: Number(r.quantity),
        cost: Number(r.cost) || 0,
        price: Number(r.price) || 0,
        description: r.description
      }))
    }

    if (!isOnline) {
      saveReturnForSync(payload)
      setUnsyncedReturns(getUnsyncedReturns())
      alert('📦 تم حفظ المرتجع محلياً بنجاح (وضع غير متصل). ستتم المزامنة تلقائياً فور عودة الإنترنت.')
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      setRows([])
      setInvoiceNo(`RET-${Date.now().toString().slice(-6)}`)
      applyDefaultRoyaVendor(vendors)
      return
    }

    if (!confirm(`تأكيد حفظ مرتجع مشتريات للمورد (${selectedVendor.name}) بقيمة ${totalAmount.toLocaleString()} ج.م؟`)) return

    setIsSaving(true)
    const res = await createPurchaseInvoice(payload)
    setIsSaving(false)

    if (res.success) {
      alert(res.message)
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      router.push(`/admin/vendors/${selectedVendor.id}`)
    } else {
      alert('❌ خطأ: ' + res.error)
    }
  }

  // مزامنة المرتجعات المعلقة يدوياً
  const syncAllReturns = async () => {
    if (isSyncing || !navigator.onLine) return
    setIsSyncing(true)
    const pending = getUnsyncedReturns().filter((r: any) => r.syncStatus !== 'synced')

    for (const r of pending) {
      setUnsyncedReturns(updateUnsyncedReturn(r.invoiceNo, { syncStatus: 'syncing' }))
      try {
        const res = await createPurchaseInvoice(r)
        if (res.success) {
          setUnsyncedReturns(removeReturnFromSyncQueue(r.invoiceNo))
        } else {
          setUnsyncedReturns(updateUnsyncedReturn(r.invoiceNo, { syncStatus: 'error', error: res.error }))
        }
      } catch (err: any) {
        setUnsyncedReturns(updateUnsyncedReturn(r.invoiceNo, { syncStatus: 'error', error: err.message }))
      }
    }
    setIsSyncing(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-5 font-sans pb-44" dir="rtl">
      
      {/* إشعار سريع للمسودة المسترجعة أو النظام */}
      {notice && (
        <div className={`mb-3 p-3 rounded-2xl shadow-xl flex justify-between items-center text-xs font-bold border animate-in slide-in-from-top duration-300 ${
          notice.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 'bg-amber-600/90 border-amber-400 text-white'
        }`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-white text-sm px-1 font-bold">✕</button>
        </div>
      )}

      {/* مؤشر حالة الشبكة وزر الخروج المحمي */}
      <div className="flex justify-between items-center mb-3">
        <span className={`px-3 py-1 text-xs font-black rounded-full flex items-center gap-1.5 ${
          isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {isOnline ? 'متصل بالشبكة (أونلاين)' : 'أوفلاين (حفظ محلي)'}
        </span>

        <button
          type="button"
          onClick={handleExitClick}
          className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-3 py-1 rounded-xl text-xs font-bold transition border border-slate-700"
        >
          ← خروج
        </button>
      </div>

      {/* تنبيه بالمرتجعات المعلقة للمزامنة */}
      {unsyncedReturns.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-3 mb-4 flex justify-between items-center text-xs">
          <div>
            <span className="font-black text-amber-300 block">⚠️ مرتجعات بانتظار المزامنة: {unsyncedReturns.length}</span>
            <span className="text-slate-400">ستتم المزامنة تلقائياً عند استقرار الإنترنت</span>
          </div>
          <button
            onClick={syncAllReturns}
            disabled={!isOnline || isSyncing}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl font-bold shadow"
          >
            {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن ⟳'}
          </button>
        </div>
      )}

      {/* بطاقة المورد والإعدادات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl mb-4 space-y-3">
        
        {/* اختيار المورد مع تعيين "رؤية" افتراضياً وإمكانية تغييره */}
        <div className="relative" ref={vendorRef}>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-300">المورد المستلم للمرتجع *</label>
            {selectedVendor && (
              <span className="text-[11px] text-emerald-400 font-mono font-bold">
                كود: {selectedVendor.code}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث عن مورد بالاسم أو الكود..."
              value={vendorSearch}
              onChange={(e) => {
                setVendorSearch(e.target.value)
                setShowVendorDropdown(true)
                if (e.target.value.trim() === '') setSelectedVendor(null)
              }}
              onFocus={() => setShowVendorDropdown(true)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-16 text-white text-sm font-bold focus:border-rose-500 outline-none"
            />
            
            {/* زر تفريغ وتغيير المورد */}
            {selectedVendor && (
              <button
                type="button"
                onClick={() => {
                  setSelectedVendor(null)
                  setVendorSearch('')
                  setShowVendorDropdown(true)
                }}
                className="absolute left-2.5 top-2.5 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 px-2 py-1 rounded-lg text-xs font-bold transition"
                title="تغيير المورد"
              >
                تغيير ✕
              </button>
            )}
          </div>

          {showVendorDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl mt-1 max-h-56 overflow-y-auto divide-y divide-slate-800">
              {filteredVendors.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 font-bold">لا يوجد مورد بهذا الاسم</div>
              ) : (
                filteredVendors.map(v => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVendor(v)
                      setVendorSearch(v.name)
                      setShowVendorDropdown(false)
                    }}
                    className={`p-3 hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs ${
                      selectedVendor?.id === v.id ? 'bg-slate-800/80 font-bold' : ''
                    }`}
                  >
                    <div>
                      <span className="font-bold text-white block text-sm">{v.name}</span>
                      <span className="text-slate-400 text-[11px]">{v.phone || 'بدون هاتف'}</span>
                    </div>
                    <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-rose-300 font-bold">
                      {v.code}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* طريقة الاسترداد ورقم الإذن */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-bold">حساب الاسترداد</label>
            <select
              value={paymentStatus}
              onChange={(e: any) => setPaymentStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold outline-none"
            >
              <option value="CREDIT">خصم من حساب المورد (آجل)</option>
              <option value="CASH">استرداد كاش فوري للخزنة</option>
            </select>
          </div>

          {paymentStatus === 'CASH' ? (
            <div>
              <label className="text-slate-400 block mb-1 font-bold">الخزنة المستلمة</label>
              <select
                value={selectedSafeId}
                onChange={(e) => setSelectedSafeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold outline-none"
              >
                {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-slate-400 block mb-1 font-bold">رقم إذن المرتجع</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-300 font-mono text-xs font-bold outline-none"
              />
            </div>
          )}
        </div>

      </div>

      {/* البحث اليدوي وزر الكاميرا */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 ابحث بكود الموديل لإضافته للمرتجع..."
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm font-bold focus:border-rose-500 outline-none"
            />
            {manualSearch && (
              <button
                onClick={() => setManualSearch('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenScanner}
            className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center shrink-0 shadow-lg shadow-rose-900/40 transition"
            title="مسح باركود بالكاميرا"
          >
            <span className="text-xl">📷</span>
          </button>
        </div>

        {/* نتائج البحث اليدوي المباشر */}
        {manualSearchResults.length > 0 && (
          <div className="mt-2 divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-xl max-h-56 overflow-y-auto">
            {manualSearchResults.map(prod => (
              <div
                key={prod.id}
                onClick={() => handleSelectProduct(prod)}
                className="p-3 hover:bg-slate-900 cursor-pointer flex justify-between items-center transition"
              >
                <div>
                  <span className="font-black text-white text-base block">{prod.modelNo}</span>
                  <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="text-rose-400 font-bold">اللون: {prod.color}</span>
                    {prod.description && <span>• {prod.description}</span>}
                  </div>
                </div>

                <div className="text-left font-mono">
                  <span className="text-emerald-400 font-bold text-sm block">{prod.cost} ج.م</span>
                  <span className="text-[10px] text-slate-500">متاح: {prod.currentStock ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* قائمة الأصناف المضافة على شكل كروت احترافية */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-black text-slate-300 flex items-center gap-2">
            <span>📦 أصناف المرتجع المضافة</span>
            <span className="bg-rose-950/60 text-rose-300 border border-rose-600/40 px-2 py-0.5 rounded-full text-xs font-mono">
              {rows.length} صنف
            </span>
          </h2>

          {rows.length > 0 && (
            <button
              onClick={() => {
                if (confirm('تفريغ كافة الأصناف المضافة من الفاتورة؟')) {
                  setRows([])
                  localStorage.removeItem(DRAFT_STORAGE_KEY)
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold"
            >
              مسح الكل ✕
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm font-bold">
            <span className="text-4xl block mb-2 opacity-50">📤</span>
            لا توجد أصناف مضافة للمرتجع حتى الآن.<br />
            امسح الباركود بالكاميرا أو ابحث بالموديل للبدء فوراً.
          </div>
        ) : (
          rows.map((row, idx) => {
            const lineTotal = (Number(row.quantity) || 0) * (Number(row.cost) || 0)
            const qtyNum = Number(row.quantity) || 0

            return (
              <div
                key={row.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition relative overflow-hidden"
              >
                {/* رأس الكارت */}
                <div className="flex justify-between items-start gap-2 mb-2 pb-2 border-b border-slate-800/80">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">كود الموديل:</span>
                      <span className="font-mono font-black text-white text-lg">{row.modelNo}</span>
                      <button
                        onClick={() => openColorPicker(idx)}
                        className="bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-lg text-xs font-bold"
                        title="تغيير اللون"
                      >
                        اللون: {row.color} ✏️
                      </button>
                    </div>

                    {/* الوصف */}
                    <div className="mt-1">
                      <input
                        type="text"
                        placeholder="أدخل وصف الصنف..."
                        value={row.description || ''}
                        onChange={(e) => updateRow(idx, 'description', e.target.value)}
                        className="w-full bg-transparent text-slate-400 text-xs outline-none focus:text-white border-b border-transparent focus:border-slate-700 py-0.5"
                      />
                    </div>
                  </div>

                  {/* زر الحذف */}
                  <button
                    onClick={() => removeRow(idx)}
                    className="w-8 h-8 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 flex items-center justify-center font-bold text-sm transition"
                    title="حذف هذا الصنف"
                  >
                    🗑️
                  </button>
                </div>

                {/* جسم الكارت: السعر والتكلفة وإجمالي البند */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block mb-1">سعر تكلفة الشراء (ج.م):</span>
                    <input
                      type="number"
                      step="0.01"
                      value={row.cost}
                      onChange={(e) => updateRow(idx, 'cost', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 font-mono font-black text-emerald-400 text-sm outline-none"
                    />
                  </div>

                  <div className="text-left flex flex-col justify-center">
                    <span className="text-slate-400 block mb-1">إجمالي استرداد الصنف:</span>
                    <span className="font-mono font-black text-rose-400 text-base">
                      {lineTotal.toLocaleString()} <small className="text-[10px] text-slate-400 font-normal">ج.م</small>
                    </span>
                    {row.currentStock !== undefined && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        رصيد المخزن الحالي: {row.currentStock}
                      </span>
                    )}
                  </div>
                </div>

                {/* إدخال الكمية المرتجعة مع Numeric Keypad مباشر */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-black text-slate-300">الكمية المرتجعة:</span>

                  <div className="flex items-center gap-1.5">
                    {/* زر إنقاص */}
                    <button
                      type="button"
                      onClick={() => updateRow(idx, 'quantity', Math.max(0, qtyNum - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-800 active:bg-slate-700 border border-slate-700 text-white font-black text-lg flex items-center justify-center"
                    >
                      -
                    </button>

                    {/* حقل الإدخال الرقمي مع تفعيل لوحة أرقام الموبايل وتحديد المحتوى فوراً */}
                    <input
                      ref={(el) => { qtyInputRefs.current[row.id] = el }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={row.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        updateRow(idx, 'quantity', val === '' ? '' : parseInt(val, 10))
                      }}
                      className="w-20 h-10 bg-slate-950 border-2 border-rose-500/60 focus:border-rose-400 rounded-xl text-center font-mono font-black text-rose-300 text-xl outline-none shadow-inner"
                    />

                    {/* زر زيادة */}
                    <button
                      type="button"
                      onClick={() => updateRow(idx, 'quantity', qtyNum + 1)}
                      className="w-10 h-10 rounded-xl bg-slate-800 active:bg-slate-700 border border-slate-700 text-white font-black text-lg flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {/* أزرار مضاعفات سريعة للكميات */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateRow(idx, 'quantity', qtyNum + 4)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2 py-1.5 rounded-lg text-xs font-bold font-mono"
                      title="إضافة 4 قطع"
                    >
                      +4
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRow(idx, 'quantity', qtyNum + 12)}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2 py-1.5 rounded-lg text-xs font-bold font-mono"
                      title="إضافة دستة 12 قطعة"
                    >
                      +12
                    </button>
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* مودال الكاميرا لمسح الباركود (محمي ضد الخروج بـ Back) */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 rounded-3xl overflow-hidden relative border-2 border-rose-500 shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-white">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <span>📷</span>
                <span>وجه الكاميرا نحو باركود الصنف المرتجع</span>
              </span>
              <button
                onClick={() => setShowScanner(false)}
                className="bg-rose-600 hover:bg-rose-500 text-white w-7 h-7 rounded-full font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="aspect-square w-full bg-black relative flex items-center justify-center">
              <BarcodeScanner onScan={handleBarcodeScanned} />
              <div className="absolute inset-0 pointer-events-none border-2 border-rose-500/40 m-8 rounded-2xl flex items-center justify-center">
                <div className="w-full h-0.5 bg-rose-500 animate-pulse"></div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 text-center">
              <button
                onClick={() => setShowScanner(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                إلغاء السكانر (أو اضغط زر الرجوع)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تغيير اللون السريع */}
      {editingRowIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-white">
                اختيار لون الموديل: {rows[editingRowIndex]?.modelNo}
              </h3>
              <button onClick={() => setEditingRowIndex(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {availableColorsForEdit.map((c, i) => (
                <div
                  key={i}
                  onClick={() => {
                    updateRow(editingRowIndex, 'color', c.color)
                    if (c.cost) updateRow(editingRowIndex, 'cost', c.cost)
                    setEditingRowIndex(null)
                  }}
                  className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer flex justify-between items-center text-xs"
                >
                  <span className="font-bold text-white text-sm">{c.color}</span>
                  <span className="font-mono text-emerald-400">{c.cost || 0} ج.م</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEditingRowIndex(null)}
              className="w-full bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* شريط الإجراءات السفلي العائم (Floating Bottom Action Bar) */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          
          {/* ملخص الإجماليات */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 block">إجمالي المرتجع:</span>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded">
                {totalQuantity} قطعة
              </span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-400">
              {totalAmount.toLocaleString()} <small className="text-xs text-slate-400">ج.م</small>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* زر كاميرا سكانر عائم وسريع */}
            <button
              type="button"
              onClick={handleOpenScanner}
              className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition"
              title="مسح صنف جديد"
            >
              📷
            </button>

            {/* زر حفظ وتأكيد المرتجع */}
            <button
              type="button"
              onClick={handleSubmitInvoice}
              disabled={isSaving || rows.length === 0}
              className="bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 text-white px-5 sm:px-7 py-3 rounded-2xl font-black text-sm shadow-xl shadow-rose-900/40 transition flex items-center gap-1.5"
            >
              <span>{isSaving ? '⏳ جاري الحفظ...' : (isOnline ? 'حفظ المرتجع ✅' : 'حفظ محلي (أوفلاين) 📦')}</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}