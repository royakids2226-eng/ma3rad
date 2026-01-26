'use client'
import { useState, useEffect } from 'react';
import { getCustomers, getSafes, createPayment } from '@/app/actions';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function NewPaymentPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [customers, setCustomers] = useState<any[]>([]);
  const [safes, setSafes] = useState<any[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSafeId, setSelectedSafeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date] = useState(new Date().toLocaleDateString('ar-EG')); // تاريخ اليوم

  useEffect(() => {
    getCustomers().then(setCustomers);
    getSafes().then(data => {
        setSafes(data);
        if (data.length > 0) setSelectedSafeId(data[0].id);
    });
  }, []);

  const handleSave = async () => {
    if (!selectedCustomerId || !amount || !selectedSafeId) {
        alert('يرجى ملء جميع البيانات');
        return;
    }
    
    if (!session?.user?.image) return;

    const res = await createPayment({
        customerId: selectedCustomerId,
        amount: parseFloat(amount),
        safeId: selectedSafeId
    }, session.user.image); // userId

    if (res.success) {
        alert('تم تسجيل الدفعة بنجاح');
        router.push('/');
    } else {
        alert('حدث خطأ');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">💰 تحصيل دفعة نقدية</h1>
            <button onClick={() => router.back()} className="text-sm text-gray-500">إلغاء</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            
            {/* التاريخ */}
            <div>
                <label className="block text-gray-500 text-sm mb-1">التاريخ</label>
                <div className="font-bold text-lg border-b pb-2">{date}</div>
            </div>

            {/* العميل */}
            <div>
                <label className="block text-gray-500 text-sm mb-1 font-bold">العميل</label>
                <select 
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-gray-50 text-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">-- اختر العميل --</option>
                    {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* القيمة */}
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

            {/* الخزنة */}
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