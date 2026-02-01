'use client'
import { useState, useEffect, useRef, use } from 'react';
import { getOrderById, searchProducts, updateOrder, getSafes, searchCustomers } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PIECES_PER_UNIT = 4;

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [safes, setSafes] = useState<any[]>([]);
  const [order, setOrder] = useState<any>(null);
  
  // Product Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});

  // Cart logic
  const [cart, setCart] = useState<any[]>([]);
  const [deposit, setDeposit] = useState<string>('');
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');
  const [showDiscountOptions, setShowDiscountOptions] = useState(false);

  useEffect(() => {
    getSafes().then(setSafes);
    
    getOrderById(id).then(res => {
        if (!res) {
            alert("الأوردر غير موجود");
            return router.push('/orders/list');
        }
        setOrder(res);
        setDeposit(res.deposit.toString());
        setSelectedSafeId(res.safeId || '');
        
        // تحويل بيانات الأوردر القديم لشكل "السلة" لكي يقبلها النظام
        const initialCart: any[] = [];
        const modelGroups: {[key: string]: any} = {};
        
        res.items.forEach((item: any) => {
            const modelNo = item.product.modelNo;
            if (!modelGroups[modelNo]) {
                modelGroups[modelNo] = {
                    type: 'product',
                    id: Math.random(),
                    modelNo: modelNo,
                    baseDescription: item.product.description,
                    unitPrice: item.product.price,
                    variants: []
                };
            }
            modelGroups[modelNo].variants.push({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                color: item.product.color,
                discountPercent: item.discountPercent,
                productDiscount: item.product.discount // الخصم التلقائي المسجل للصنف
            });
        });

        Object.values(modelGroups).forEach((group: any) => {
            // إضافة سطر الخصم إذا كان موجوداً
            const disc = group.variants[0].discountPercent;
            if (disc > 0) {
                initialCart.push({ type: 'discount', percent: disc, id: Math.random() });
            }
            group.totalQty = group.variants.reduce((sum: number, v: any) => sum + v.quantity, 0);
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
        const variant = { 
            productId: p.id, 
            quantity: selectionMap[p.id], 
            price: p.price, 
            color: p.color, 
            discountPercent: 0,
            productDiscount: p.discount 
        };
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

  const handleApplyAutoProductDiscounts = () => {
    let newCart: any[] = [];
    cart.forEach(item => {
        if(item.type === 'product') {
            const autoPct = item.variants[0]?.productDiscount || 0;
            if(autoPct > 0) {
                newCart.push({ type: 'discount', percent: autoPct, id: Math.random() });
            }
        }
        newCart.push(item);
    });
    setCart(newCart);
    setShowDiscountOptions(false);
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
      const res = await updateOrder(id, { 
          items: cleanCart, 
          total, 
          deposit: parseFloat(deposit) || 0, 
          safeId: selectedSafeId,
          currency: order.currency
      });
      if (res.success) {
          alert("تم تحديث الأوردر وإعادة ضبط المخزون بنجاح ✅");
          router.push('/orders/list');
      } else { alert("خطأ في التحديث"); }
  };

  if (loading) return <div className="p-10 text-center font-bold animate-pulse">جاري جلب بيانات الأوردر...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-yellow-500">
        <div>
            <h2 className="font-bold text-lg">✏️ تعديل أوردر #{order?.orderNo}</h2>
            <p className="text-xs text-gray-500">العميل: {order?.customer.name}</p>
        </div>
        <Link href="/orders/list" className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-bold">إلغاء</Link>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        
        {/* إضافة أصناف جديدة */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <label className="block text-sm font-bold text-gray-600 mb-2">إضافة أصناف جديدة للأوردر:</label>
            <input type="text" placeholder="🔍 ابحث برقم الموديل..." className="w-full p-4 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchResults.length > 0 && (
                <div className="mt-2 bg-white border rounded-xl shadow-lg overflow-hidden divide-y">
                    {searchResults.map(p => (
                        <div key={p.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                            <div>
                                <div className="font-bold">{p.modelNo} - {p.color}</div>
                                <div className="text-xs text-gray-400">المخزن: {p.stockQty}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="number" placeholder="كمية" className="w-16 border rounded p-1 text-center font-bold" onChange={e => setSelectionMap({...selectionMap, [p.id]: parseInt(e.target.value)})} />
                                <button onClick={handleAddToCart} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">إضافة</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* محتويات السلة (الأوردر) */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-700">مكونات الأوردر الحالية:</h3>
                <button onClick={handleApplyAutoProductDiscounts} className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow animate-pulse">🏷️ تطبيق خصم الموديلات</button>
            </div>
            {cart.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-xl shadow-sm border flex justify-between items-center ${item.type === 'discount' ? 'bg-yellow-50 border-yellow-300 border-dashed' : 'bg-white border-gray-100'}`}>
                    <div>
                        {item.type === 'discount' ? (
                            <span className="text-yellow-800 font-bold">✂️ خصم {item.percent}% على ما يليه</span>
                        ) : (
                            <div>
                                <span className="font-bold text-lg">{item.modelNo}</span>
                                <div className="text-xs text-gray-500">إجمالي الدرز: {item.totalQty}</div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="bg-red-50 text-red-500 p-2 rounded-full hover:bg-red-100 transition">🗑️</button>
                </div>
            ))}
        </div>

        {/* الحساب النهائي */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
            <div className="flex justify-between text-2xl font-black mb-6 border-b border-slate-700 pb-4">
                <span>إجمالي الحساب:</span>
                <span className="text-yellow-400">{getProcessedCart().reduce((a,i)=>a+i.totalLinePrice,0).toFixed(0)} {order?.currency}</span>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-slate-400 mb-1 font-bold">العربون المسدد (بالجنيه):</label>
                    <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} className="w-full p-4 rounded-xl bg-slate-800 text-white font-bold text-xl border border-slate-700 focus:border-yellow-500 outline-none" />
                </div>

                {parseFloat(deposit) > 0 && (
                    <div className="animate-in fade-in duration-500">
                        <label className="block text-sm text-slate-400 mb-1 font-bold">تعديل خزنة الإيداع:</label>
                        <select value={selectedSafeId} onChange={e => setSelectedSafeId(e.target.value)} className="w-full p-4 rounded-xl bg-slate-800 text-white font-bold border border-slate-700">
                            {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <button onClick={handleUpdate} className="w-full bg-yellow-500 text-slate-900 py-5 rounded-2xl font-black text-xl mt-8 hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-yellow-900/20">
                تحديث وحفظ التعديلات ✅
            </button>
        </div>
      </div>
    </div>
  );
}