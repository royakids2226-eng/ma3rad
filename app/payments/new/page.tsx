'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, getSafes, createPayment, searchCustomers } from '@/app/actions'; // 👈 استيراد
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function NewPaymentPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [safes, setSafes] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSafeId, setSelectedSafeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date] = useState(new Date().toLocaleDateString('ar-EG')); 

  // حالات البحث عن العميل
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]); // النتائج
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // تحميل أولي للعملاء
    getCustomers().then(setCustomerResults);
    
    getSafes().then(data => {
        setSafes(data);
        if (data.length > 0) setSelectedSafeId(data[0].id);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (customerListRef.current && !customerListRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 👇 البحث الحي عند الكتابة
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
    if (!selectedCustomerId || !amount || !selectedSafeId) {
        alert('يرجى اختيار العميل وتحديد المبلغ والخزنة');
        return;
    }
    if (!session?.user?.image) return;

    const res = await createPayment({
        customerId: selectedCustomerId,
        amount: parseFloat(amount),
        safeId: selectedSafeId
    }, session.user.image);

    if (res.success) {
        alert('تم تسجيل الدفعة بنجاح');
        router.push('/');
    } else {
        alert('حدث خطأ أثناء التسجيل');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">💰 تحصيل دفعة نقدية</h1>
            <button onClick={() => router.back()} className="text-sm text-gray-500">إلغاء</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <div>
                <label className="block text-gray-500 text-sm mb-1">التاريخ</label>
                <div className="font-bold text-lg border-b pb-2">{date}</div>
            </div>

            <div className="relative" ref={customerListRef}>
                <label className="block text-gray-500 text-sm mb-1 font-bold">العميل</label>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="ابحث باسم العميل (بدون همزات) أو الهاتف..."
                        value={customerSearchTerm}
                        onChange={(e) => {
                            setCustomerSearchTerm(e.target.value);
                            setShowCustomerList(true);
                            if (e.target.value === '') setSelectedCustomerId('');
                        }}
                        onFocus={() => setShowCustomerList(true)}
                        className="w-full p-3 border rounded-lg bg-gray-50 text-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearchingCustomer && <span className="absolute left-3 top-3 text-gray-400 text-xs">جاري البحث...</span>}
                </div>

                {showCustomerList && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                        {customerResults.length > 0 ? (
                             customerResults.map(c => (
                                <div 
                                    key={c.id}
                                    onClick={() => {
                                        setSelectedCustomerId(c.id);
                                        setCustomerSearchTerm(c.name);
                                        setShowCustomerList(false);
                                    }}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                >
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {c.phone} {c.phone2 ? ` | ${c.phone2}` : ''}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-gray-500">لا توجد نتائج</div>
                        )}
                    </div>
                )}
            </div>

            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">المبلغ المحصل</label>
                <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 border rounded-lg text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">توريد إلى الخزنة</label>
                <select 
                    value={selectedSafeId}
                    onChange={(e) => setSelectedSafeId(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-yellow-50 text-lg outline-none focus:ring-2 focus:ring-yellow-500 border-yellow-200"
                >
                    {safes.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 mt-4"
            >
                حفظ الإيصال ✅
            </button>
        </div>
    </div>
  );
}