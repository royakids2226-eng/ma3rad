'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, getSafes, createPayment, searchCustomers } from '@/app/actions';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function CashManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // الحالة العامة للتبويبات
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN');

  const [safes, setSafes] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date] = useState(new Date().toLocaleDateString('ar-EG')); 

  // حالات الخزينة
  const [selectedSafeId, setSelectedSafeId] = useState('');       // الخزنة الأساسية (المصدر في التحويل والصرف، والمستلمة في القبض)
  const [targetSafeId, setTargetSafeId] = useState('');           // الخزنة المستهدفة (للتحويل فقط)

  // حالات العميل (للتبويب IN فقط)
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCustomers().then(setCustomerResults);
    getSafes().then(data => {
        setSafes(data);
        if (data.length > 0) {
            setSelectedSafeId(data[0].id);
            // تعيين قيمة افتراضية للخزنة المستهدفة مختلفة عن الأولى
            if (data.length > 1) setTargetSafeId(data[1].id);
        }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (customerListRef.current && !customerListRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // البحث الحي للعملاء
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
        if (customerSearchTerm.length > 0) {
            setIsSearchingCustomer(true);
            const results = await searchCustomers(customerSearchTerm);
            setCustomerResults(results);
            setIsSearchingCustomer(false);
        } else {
             getCustomers().then(setCustomerResults);
        }
      }, 300);

      return () => clearTimeout(delayDebounceFn);
  }, [customerSearchTerm]);

  const handleSave = async () => {
    if (!amount || !selectedSafeId) return alert('البيانات الأساسية ناقصة');
    if (activeTab === 'IN' && !selectedCustomerId) return alert('يجب اختيار العميل لسند القبض');
    if ((activeTab === 'OUT' || activeTab === 'TRANSFER') && !description) return alert('يجب كتابة وصف أو بيان');
    if (activeTab === 'TRANSFER' && (!targetSafeId || targetSafeId === selectedSafeId)) return alert('يجب اختيار خزنة مختلفة للتحويل إليها');

    if (!session?.user?.image) return;

    const res = await createPayment({
        type: activeTab,
        customerId: activeTab === 'IN' ? selectedCustomerId : undefined,
        amount: parseFloat(amount),
        safeId: selectedSafeId,
        targetSafeId: activeTab === 'TRANSFER' ? targetSafeId : undefined,
        description: description
    }, session.user.image);

    if (res.success) {
        alert('تمت العملية بنجاح ✅');
        router.push('/');
    } else {
        alert('❌ حدث خطأ أثناء التسجيل');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">💰 إدارة النقدية والخزينة</h1>
            <button onClick={() => router.back()} className="text-sm text-gray-500 bg-white px-3 py-1 rounded border">عودة</button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6">
            <button onClick={() => setActiveTab('IN')} className={`flex-1 py-3 font-bold rounded-lg shadow-sm transition-all ${activeTab === 'IN' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                📥 سند قبض
            </button>
            <button onClick={() => setActiveTab('OUT')} className={`flex-1 py-3 font-bold rounded-lg shadow-sm transition-all ${activeTab === 'OUT' ? 'bg-red-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                📤 سند صرف
            </button>
            <button onClick={() => setActiveTab('TRANSFER')} className={`flex-1 py-3 font-bold rounded-lg shadow-sm transition-all ${activeTab === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                🔄 تحويل نقدية
            </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6 border border-gray-100">
            
            {/* 1. التاريخ */}
            <div className="flex justify-between items-center border-b pb-2">
                <span className="text-gray-500 text-sm">تاريخ الحركة</span>
                <span className="font-bold text-lg font-mono">{date}</span>
            </div>

            {/* 2. اختيار العميل (يظهر فقط في سند القبض) */}
            {activeTab === 'IN' && (
                <div className="relative animate-fade-in" ref={customerListRef}>
                    <label className="block text-green-700 text-sm mb-1 font-bold">العميل (المسدد)</label>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="ابحث باسم العميل..."
                            value={customerSearchTerm}
                            onChange={(e) => {
                                setCustomerSearchTerm(e.target.value);
                                setShowCustomerList(true);
                                if (e.target.value === '') setSelectedCustomerId('');
                            }}
                            onFocus={() => setShowCustomerList(true)}
                            className="w-full p-3 border rounded-lg bg-green-50 text-lg outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {isSearchingCustomer && <span className="absolute left-3 top-3 text-gray-400 text-xs">جاري البحث...</span>}
                    </div>
                    {showCustomerList && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                            {customerResults.map(c => (
                                <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchTerm(c.name); setShowCustomerList(false); }} className="p-3 hover:bg-green-50 cursor-pointer border-b last:border-0">
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-xs text-gray-500">{c.phone}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 3. الخزن والمبلغ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* المبلغ */}
                <div>
                    <label className="block text-gray-500 text-sm mb-1 font-bold">المبلغ</label>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-3 border rounded-lg text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 text-left ltr"
                    />
                </div>

                {/* الخزنة (تتغير التسمية حسب التبويب) */}
                <div>
                    <label className="block text-gray-500 text-sm mb-1 font-bold">
                        {activeTab === 'IN' ? 'توريد إلى الخزنة' : activeTab === 'OUT' ? 'صرف من الخزنة' : 'من خزنة (المصدر)'}
                    </label>
                    <select 
                        value={selectedSafeId}
                        onChange={(e) => setSelectedSafeId(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-gray-50 text-lg outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* 4. التحويل إلى خزنة (يظهر فقط في التحويل) */}
            {activeTab === 'TRANSFER' && (
                <div className="animate-fade-in bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-blue-800 text-sm mb-1 font-bold">إلى خزنة (المستلم)</label>
                    <select 
                        value={targetSafeId}
                        onChange={(e) => setTargetSafeId(e.target.value)}
                        className="w-full p-3 border border-blue-300 rounded-lg bg-white text-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                         {safes.filter(s => s.id !== selectedSafeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            {/* 5. البيان / الوصف (يظهر في الكل لكنه إجباري في الصرف والتحويل) */}
            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">
                    {activeTab === 'IN' ? 'ملاحظات (اختياري)' : 'البيان / الوصف (إجباري)'}
                </label>
                <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={activeTab === 'OUT' ? 'مثال: فاتورة كهرباء، عهدة موظف...' : activeTab === 'TRANSFER' ? 'مثال: تقفيل شيفت، تغذية الكاشير...' : 'ملاحظات إضافية...'}
                    className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-gray-400 h-24"
                />
            </div>

            {/* زر الحفظ */}
            <button 
                onClick={handleSave}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg text-white transition-all
                    ${activeTab === 'IN' ? 'bg-green-600 hover:bg-green-700' : 
                      activeTab === 'OUT' ? 'bg-red-600 hover:bg-red-700' : 
                      'bg-blue-600 hover:bg-blue-700'}`}
            >
                {activeTab === 'IN' ? 'حفظ سند القبض ✅' : activeTab === 'OUT' ? 'تأكيد الصرف 💸' : 'إتمام التحويل 🔄'}
            </button>
        </div>
    </div>
  );
}