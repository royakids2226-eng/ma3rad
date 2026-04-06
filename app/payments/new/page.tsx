'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, getSafes, createPayment, searchCustomers, checkCustomerPhone } from '@/app/actions';
import { addCustomer } from '@/app/admin-actions'; // استيراد وظيفة الإضافة
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function CashManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // الحالة العامة للتبويبات
  const [activeTab, setActiveTab] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN');

  const [safes, setSafes] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EGP'); 
  const [description, setDescription] = useState('');
  const [date] = useState(new Date().toLocaleDateString('ar-EG')); 

  // حالات الخزينة
  const [selectedSafeId, setSelectedSafeId] = useState('');       
  const [targetSafeId, setTargetSafeId] = useState('');           

  // حالات العميل (للتبويب IN فقط)
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null);

  // Quick Add Customer States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', phone2: '', code: '', address: '' });
  const [isSavingCust, setIsSavingCust] = useState(false);

  useEffect(() => {
    getCustomers().then(setCustomerResults);
    getSafes().then(data => {
      setSafes(data);
      if (data.length > 0) {
        const mainSafe = data.find(safe => safe.name === 'الخزنة الرئيسية');
        if (mainSafe) {
          setSelectedSafeId(mainSafe.id);
        } else {
          setSelectedSafeId(data[0].id);
        }
        if (data.length > 1) {
          const secondSafe = data.find(s => s.id !== (mainSafe ? mainSafe.id : data[0].id));
          if(secondSafe) setTargetSafeId(secondSafe.id);
        }
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

  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
        if (customerSearchTerm.length > 0) {
            setIsSearchingCustomer(true);
            const results = await searchCustomers(customerSearchTerm);
            setCustomerResults(results);
            setIsSearchingCustomer(false);
        } else { getCustomers().then(setCustomerResults); }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
  }, [customerSearchTerm]);

  // 👇 تعديل الإضافة السريعة مع التحقق ✅
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newCust.name) return alert('الاسم مطلوب');
      
      setIsSavingCust(true);

      // 🔴 التحقق من الهاتف قبل الإرسال
      if (newCust.phone || newCust.phone2) {
          const checkRes = await checkCustomerPhone(newCust.phone || newCust.phone2);
          if (checkRes.exists) {
              const confirmMsg = `⚠️ تنبيه: رقم الهاتف هذا مسجل مسبقاً للعميل:\n\n👤 ${checkRes.name}\n\nهل تريد الاستمرار وإضافة هذا العميل الجديد بنفس الرقم؟`;
              if (!window.confirm(confirmMsg)) {
                  setIsSavingCust(false);
                  return; // إلغاء العملية
              }
          }
      }
      // 🔴 نهاية التحقق

      const res = await addCustomer({ ...newCust, source: 'QUICK' });
      
      if (res.warning) {
          setIsSavingCust(false);
          if (confirm(`رقم الهاتف مسجل مسبقاً باسم: (${res.existingName}).\nهل تريد الاستمرار؟`)) {
              setIsSavingCust(true);
              const resForce = await addCustomer({ ...newCust, source: 'QUICK', force: true });
              if (resForce.success) {
                  setSelectedCustomerId(resForce.customer.id);
                  setCustomerSearchTerm(resForce.customer.name);
                  setIsQuickAddOpen(false);
                  setNewCust({ name: '', phone: '', phone2: '', code: '', address: '' });
              } else { alert("خطأ: " + resForce.error); }
          }
          setIsSavingCust(false);
          return;
      }

      if(res.success) {
          setSelectedCustomerId(res.customer.id);
          setCustomerSearchTerm(res.customer.name);
          setIsQuickAddOpen(false);
          setNewCust({ name: '', phone: '', phone2: '', code: '', address: '' });
      } else { alert("خطأ: " + res.error); }
      setIsSavingCust(false);
  };

  const handleSave = async () => {
    if (!amount || !selectedSafeId) return alert('البيانات الأساسية ناقصة');
    if (activeTab === 'IN' && !selectedCustomerId) return alert('يجب اختيار العميل');
    if ((activeTab === 'OUT' || activeTab === 'TRANSFER') && !description) return alert('يجب كتابة بيان');

    const res = await createPayment({
        type: activeTab,
        customerId: activeTab === 'IN' ? selectedCustomerId : undefined,
        amount: parseFloat(amount),
        currency: currency, 
        safeId: selectedSafeId,
        targetSafeId: activeTab === 'TRANSFER' ? targetSafeId : undefined,
        description: description
    }, session?.user?.image as string);

    if (res.success) { alert('تمت العملية بنجاح ✅'); router.push('/'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <h1 className="text-xl font-bold mb-6">💰 إدارة النقدية والخزينة</h1>
        
        <div className="flex gap-2 mb-6">
            <button onClick={() => setActiveTab('IN')} className={`flex-1 py-3 font-bold rounded-lg ${activeTab === 'IN' ? 'bg-green-600 text-white' : 'bg-white'}`}>📥 قبض</button>
            <button onClick={() => setActiveTab('OUT')} className={`flex-1 py-3 font-bold rounded-lg ${activeTab === 'OUT' ? 'bg-red-600 text-white' : 'bg-white'}`}>📤 صرف</button>
            <button onClick={() => setActiveTab('TRANSFER')} className={`flex-1 py-3 font-bold rounded-lg ${activeTab === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white'}`}>🔄 تحويل</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            {activeTab === 'IN' && (
                <div className="relative animate-fade-in" ref={customerListRef}>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold">العميل</label>
                        <button onClick={() => setIsQuickAddOpen(true)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">➕ جديد</button>
                    </div>
                    <input type="text" placeholder="ابحث باسم العميل..." value={customerSearchTerm} onChange={(e) => { setCustomerSearchTerm(e.target.value); setShowCustomerList(true); }} onFocus={() => setShowCustomerList(true)} className="w-full p-3 border rounded-lg bg-green-50 text-lg outline-none" />
                    {showCustomerList && (
                        <div className="absolute top-full left-0 right-0 bg-white border z-50 max-h-60 overflow-y-auto shadow-xl">
                            {customerResults.map(c => (
                                <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchTerm(c.name); setShowCustomerList(false); }} className={`p-3 hover:bg-green-50 cursor-pointer border-b ${c.source === 'QUICK' ? 'bg-purple-50' : ''}`}>
                                    <div className="font-bold">{c.name} {c.source === 'QUICK' && '✨'}</div>
                                    <div className="text-xs text-gray-500">{c.phone} | {c.code}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-gray-500 text-sm mb-1 font-bold">المبلغ</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 border rounded-lg text-2xl font-bold outline-none" />
                </div>
                <div>
                    <label className="block text-gray-500 text-sm mb-1 font-bold">العملة</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full p-3 border rounded-lg bg-blue-50 text-lg font-bold outline-none">
                        <option value="EGP">جنيه مصري</option>
                        <option value="USD">دولار أمريكي</option>
                        <option value="SAR">ريال سعودي</option>
                        <option value="KWD">دينار كويتي</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">الخزنة</label>
                <select value={selectedSafeId} onChange={(e) => setSelectedSafeId(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 text-lg">
                    {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {activeTab === 'TRANSFER' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-blue-800 text-sm mb-1 font-bold">إلى خزنة (المستلم)</label>
                    <select value={targetSafeId} onChange={(e) => setTargetSafeId(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg bg-white text-lg">
                         {safes.filter(s => s.id !== selectedSafeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">البيان / الوصف</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="اكتب التفاصيل هنا..." className="w-full p-3 border rounded-lg outline-none h-24" />
            </div>

            <button onClick={handleSave} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg text-white ${activeTab === 'IN' ? 'bg-green-600' : activeTab === 'OUT' ? 'bg-red-600' : 'bg-blue-600'}`}>حفظ ✅</button>
        </div>

        {/* Quick Add Modal */}
        {isQuickAddOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex justify-center items-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-up">
                  <h3 className="font-bold text-lg mb-4 border-b pb-2 text-center text-blue-900">إضافة عميل جديد</h3>
                  <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">الاسم</label><input type="text" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm" required /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">الكود (تلقائي لو فارغ)</label><input type="text" value={newCust.code} onChange={e => setNewCust({...newCust, code: e.target.value})} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">هاتف 1</label><input type="text" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">هاتف 2</label><input type="text" value={newCust.phone2} onChange={e => setNewCust({...newCust, phone2: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm bg-yellow-50" /></div>
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label><input type="text" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="w-full border p-3 rounded-xl" /></div>
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setIsQuickAddOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-lg font-bold">إلغاء</button>
                          <button type="submit" disabled={isSavingCust} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg">حفظ واختيار ✅</button>
                      </div>
                  </form>
              </div>
          </div>
        )}
    </div>
  );
}