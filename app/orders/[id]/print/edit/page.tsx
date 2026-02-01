'use client'
import { useState, useEffect, use } from 'react';
import { getOrderById, searchProducts, updateOrder, getSafes } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PIECES_PER_UNIT = 4;

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [safes, setSafes] = useState<any[]>([]);
  const [order, setOrder] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});
  const [cart, setCart] = useState<any[]>([]);
  const [deposit, setDeposit] = useState<string>('');
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');

  useEffect(() => {
    // تحميل البيانات الأساسية
    getSafes().then(setSafes);
    
    getOrderById(id).then(res => {
        if (!res) return router.push('/orders/list');
        setOrder(res);
        setDeposit(res.deposit.toString());
        setSelectedSafeId(res.safeId || '');
        
        // تحويل الأصناف القادمة من الداتابيز إلى شكل "السلة" لكي يفهمها الكود
        const initialCart: any[] = [];
        const grouped: {[key: string]: any} = {};
        
        res.items.forEach((item: any) => {
            const modelNo = item.product.modelNo;
            if (!grouped[modelNo]) {
                grouped[modelNo] = {
                    type: 'product',
                    id: Math.random(),
                    modelNo: modelNo,
                    baseDescription: item.product.description,
                    unitPrice: item.product.price, // السعر الأصلي
                    variants: []
                };
            }
            grouped[modelNo].variants.push({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price, // السعر بعد الخصم
                color: item.product.color,
                discountPercent: item.discountPercent
            });
        });

        Object.values(grouped).forEach((group: any) => {
            // إذا كان هناك خصم، نضيف سطر الخصم قبل الصنف في السلة
            const discount = group.variants[0].discountPercent;
            if (discount > 0) {
                initialCart.push({ type: 'discount', percent: discount, id: Math.random() });
            }
            group.totalQty = group.variants.reduce((s:any, v:any) => s + v.quantity, 0);
            initialCart.push(group);
        });

        setCart(initialCart);
        setLoading(false);
    });
  }, [id, router]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        const results = await searchProducts(searchTerm);
        setSearchResults(results);
      } else { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleAddToCart = () => {
    const selectedProducts = searchResults.filter(p => !!selectionMap[p.id]);
    let updatedCart = [...cart];
    selectedProducts.forEach(p => {
        const variant = { productId: p.id, quantity: selectionMap[p.id], price: p.price, color: p.color, discountPercent: 0 };
        const existingIdx = updatedCart.findIndex(i => i.modelNo === p.modelNo && i.type === 'product');
        if (existingIdx > -1) {
            updatedCart[existingIdx].variants.push(variant);
            updatedCart[existingIdx].totalQty += variant.quantity;
        } else {
            updatedCart.unshift({
                type: 'product', id: Math.random(), modelNo: p.modelNo, baseDescription: p.description,
                unitPrice: p.price, totalQty: variant.quantity, variants: [variant]
            });
        }
    });
    setCart(updatedCart); setSelectionMap({}); setSearchTerm('');
  };

  const getProcessedCart = () => {
      let processed: any[] = [];
      let activeDiscount = 0;
      cart.forEach(item => {
          if (item.type === 'discount') activeDiscount = item.percent;
          else {
              const discountedPrice = item.unitPrice * (1 - activeDiscount / 100);
              processed.push({
                  ...item, appliedDiscount: activeDiscount, 
                  totalLinePrice: item.variants.reduce((s:any, v:any) => s + (v.quantity * PIECES_PER_UNIT * discountedPrice), 0),
                  variants: item.variants.map((v:any) => ({ ...v, price: discountedPrice, discountPercent: activeDiscount }))
              });
          }
      });
      return processed;
  };

  const handleUpdate = async () => {
      const cleanCart = getProcessedCart();
      const total = cleanCart.reduce((a, i) => a + i.totalLinePrice, 0);
      const res = await updateOrder(id, { items: cleanCart, total, deposit: parseFloat(deposit) || 0, safeId: selectedSafeId });
      if (res.success) {
          alert("تم التحديث بنجاح ✅");
          router.push('/orders/list');
      } else { alert("خطأ في التحديث"); }
  };

  if (loading) return <div className="p-10 text-center font-bold">جاري تحميل بيانات الأوردر...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-yellow-500">
        <h2 className="font-bold text-lg">✏️ تعديل أوردر #{order?.orderNo}</h2>
        <Link href="/orders/list" className="text-sm text-gray-500">إلغاء</Link>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500 font-bold">العميل الحالي:</p>
            <p className="text-xl font-bold text-blue-900">{order?.customer.name}</p>
        </div>

        {/* حقل البحث لإضافة أصناف جديدة */}
        <div className="space-y-2">
            <input type="text" placeholder="🔍 إضافة صنف جديد للأوردر..." className="w-full p-4 border rounded-xl shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchResults.length > 0 && (
                <div className="bg-white border rounded-xl shadow-lg overflow-hidden">
                    {searchResults.map(p => (
                        <div key={p.id} className="p-3 border-b flex justify-between items-center">
                            <span>{p.modelNo} - {p.color}</span>
                            <input type="number" placeholder="كمية" className="w-16 border rounded p-1" onChange={e => setSelectionMap({...selectionMap, [p.id]: parseInt(e.target.value)})} />
                        </div>
                    ))}
                    <button onClick={handleAddToCart} className="w-full bg-black text-white py-2 font-bold">إضافة المختار</button>
                </div>
            )}
        </div>

        {/* السلة القابلة للتعديل */}
        <div className="space-y-3">
            <h3 className="font-bold">أصناف الأوردر:</h3>
            {cart.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border flex justify-between items-center">
                    <div>
                        {item.type === 'discount' ? (
                            <span className="text-red-600 font-bold">✂️ خصم {item.percent}%</span>
                        ) : (
                            <span className="font-bold">{item.modelNo} (عدد {item.totalQty})</span>
                        )}
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 text-xs font-bold">حذف 🗑️</button>
                </div>
            ))}
        </div>

        {/* الحساب النهائي */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between text-xl font-bold mb-4 border-b border-slate-700 pb-2">
                <span>صافي الحساب الجديد:</span>
                <span>{getProcessedCart().reduce((a,i)=>a+i.totalLinePrice,0).toFixed(0)} ج.م</span>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">العربون / المدفوع:</label>
                    <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} className="w-full p-3 rounded bg-white text-black font-bold" />
                </div>
                {parseFloat(deposit) > 0 && (
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">توريد إلى:</label>
                        <select value={selectedSafeId} onChange={e => setSelectedSafeId(e.target.value)} className="w-full p-3 rounded bg-white text-black font-bold">
                            {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
            </div>
            <button onClick={handleUpdate} className="w-full bg-yellow-500 text-black py-4 rounded-xl font-black text-lg mt-6 hover:bg-yellow-400 shadow-lg transition-all">تحديث وحفظ الأوردر ✅</button>
        </div>
      </div>
    </div>
  );
}