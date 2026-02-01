'use client'
import { useState, useEffect, useRef, use } from 'react';
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
  
  // Product Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});

  // Cart logic
  const [cart, setCart] = useState<any[]>([]);
  const [deposit, setDeposit] = useState<string>('');
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');

  useEffect(() => {
    getSafes().then(setSafes);
    
    getOrderById(id).then(res => {
        if (!res) return router.push('/orders/list');
        setOrder(res);
        setDeposit(res.deposit.toString());
        setSelectedSafeId(res.safeId || '');
        
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
                productDiscount: item.product.discount,
                stockAvailable: item.product.stockQty + item.quantity // متاح + المحجوز في هذا الأوردر
            });
        });

        Object.values(modelGroups).forEach((group: any) => {
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
            productDiscount: p.discount,
            stockAvailable: p.stockQty
        };
        const existingIdx = updatedCart.findIndex(i => i.modelNo === p.modelNo && i.type === 'product');
        if (existingIdx > -1) {
            const variantExists = updatedCart[existingIdx].variants.findIndex((v:any) => v.productId === p.id);
            if(variantExists > -1) updatedCart[existingIdx].variants[variantExists].quantity += variant.quantity;
            else updatedCart[existingIdx].variants.push(variant);
            updatedCart[existingIdx].totalQty = updatedCart[existingIdx].variants.reduce((s:any, v:any)=>s+v.quantity,0);
        } else {
            updatedCart.unshift({
                type: 'product', id: Math.random(), modelNo: p.modelNo, baseDescription: p.description,
                unitPrice: p.price, totalQty: variant.quantity, variants: [variant]
            });
        }
    });
    setCart(updatedCart); setSelectionMap({}); setSearchTerm('');
  };

  // 👇 وظيفة تحديث كمية لون محدد داخل السلة 👇
  const updateVariantQty = (cartItemId: number, productId: string, newQty: number) => {
      if (newQty < 1) return;
      setCart(prev => prev.map(item => {
          if (item.id === cartItemId) {
              const newVariants = item.variants.map((v: any) => 
                  v.productId === productId ? { ...v, quantity: newQty } : v
              );
              return { ...item, variants: newVariants, totalQty: newVariants.reduce((s:any, v:any)=>s+v.quantity, 0) };
          }
          return item;
      }));
  };

  // 👇 وظيفة حذف لون محدد من الموديل 👇
  const removeVariant = (cartItemId: number, productId: string) => {
      setCart(prev => prev.map(item => {
          if (item.id === cartItemId) {
              const newVariants = item.variants.filter((v: any) => v.productId !== productId);
              return { ...item, variants: newVariants, totalQty: newVariants.reduce((s:any, v:any)=>s+v.quantity, 0) };
          }
          return item;
      }).filter(item => item.type === 'discount' || item.variants.length > 0));
  };

  const handleApplyAutoProductDiscounts = () => {
    let newCart: any[] = [];
    cart.forEach(item => {
        if(item.type === 'product') {
            const autoPct = item.variants[0]?.productDiscount || 0;
            if(autoPct > 0) newCart.push({ type: 'discount', percent: autoPct, id: Math.random() });
        }
        newCart.push(item);
    });
    setCart(newCart);
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
      const res = await updateOrder(id, { items: cleanCart, total, deposit: parseFloat(deposit) || 0, safeId: selectedSafeId, currency: order.currency });
      if (res.success) { alert("تم التحديث بنجاح ✅"); router.push('/orders/list'); }
  };

  if (loading) return <div className="p-10 text-center font-bold">جاري تحميل بيانات الأوردر...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-yellow-500">
        <div><h2 className="font-bold text-lg">✏️ تعديل أوردر #{order?.orderNo}</h2><p className="text-xs text-gray-500">العميل: {order?.customer.name}</p></div>
        <Link href="/orders/list" className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-bold">إلغاء</Link>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* إضافة أصناف جديدة */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <input type="text" placeholder="🔍 إضافة ألوان/موديلات جديدة..." className="w-full p-4 border rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchResults.length > 0 && (
                <div className="mt-2 bg-white border rounded-xl shadow-lg overflow-hidden divide-y">
                    {searchResults.map(p => (
                        <div key={p.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                            <div><div className="font-bold">{p.modelNo} - {p.color}</div><div className="text-xs text-gray-400">المخزن: {p.stockQty}</div></div>
                            <div className="flex items-center gap-2">
                                <input type="number" placeholder="كمية" className="w-16 border rounded p-1 text-center font-bold" onChange={e => setSelectionMap({...selectionMap, [p.id]: parseInt(e.target.value) || 1})} />
                                <button onClick={handleAddToCart} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">إضافة</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* السلة المطورة */}
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-gray-700">مكونات الأوردر (يمكنك تعديل كمية كل لون):</h3>
                <button onClick={handleApplyAutoProductDiscounts} className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow">🏷️ خصم الموديلات</button>
            </div>

            {cart.map((item, idx) => (
                <div key={idx}>
                    {item.type === 'discount' ? (
                        <div className="bg-yellow-50 border-2 border-yellow-400 border-dashed p-3 rounded-xl flex justify-between items-center mb-2">
                            <span className="text-yellow-800 font-bold">✂️ خصم {item.percent}% على ما يليه</span>
                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 font-bold bg-white px-2 rounded border border-red-200">حذف</button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                            <div className="bg-gray-50 p-3 flex justify-between items-center border-b">
                                <span className="font-black text-blue-900 text-lg">{item.modelNo}</span>
                                <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500 text-xs font-bold">حذف الموديل بالكامل 🗑️</button>
                            </div>
                            {/* 👇 قائمة الألوان داخل الموديل 👇 */}
                            <div className="p-2 space-y-2">
                                {item.variants.map((v: any, vIdx: number) => (
                                    <div key={vIdx} className="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                        <div className="flex-1">
                                            <span className="font-bold text-blue-800">{v.color}</span>
                                            <div className="text-[10px] text-gray-500">متاح بالإجمالي: {v.stockAvailable}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
                                                <button onClick={() => updateVariantQty(item.id, v.productId, v.quantity + 1)} className="w-8 h-8 bg-gray-100 rounded font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition">+</button>
                                                <span className="w-8 text-center font-black text-lg">{v.quantity}</span>
                                                <button onClick={() => updateVariantQty(item.id, v.productId, v.quantity - 1)} className="w-8 h-8 bg-gray-100 rounded font-bold text-red-600 hover:bg-red-600 hover:text-white transition">-</button>
                                            </div>
                                            <button onClick={() => removeVariant(item.id, v.productId)} className="text-gray-400 hover:text-red-600">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>

        {/* الحساب النهائي */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl sticky bottom-4">
            <div className="flex justify-between text-2xl font-black mb-4 border-b border-slate-700 pb-2">
                <span>الحساب الجديد:</span>
                <span className="text-yellow-400">{getProcessedCart().reduce((a,i)=>a+i.totalLinePrice,0).toFixed(0)} ج.م</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] text-slate-400 mb-1">العربون:</label><input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} className="w-full p-2 rounded-lg bg-slate-800 text-white font-bold" /></div>
                {parseFloat(deposit) > 0 && (
                    <div><label className="block text-[10px] text-slate-400 mb-1">الخزنة:</label><select value={selectedSafeId} onChange={e => setSelectedSafeId(e.target.value)} className="w-full p-2 rounded-lg bg-slate-800 text-white text-xs">{safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                )}
            </div>
            <button onClick={handleUpdate} className="w-full bg-yellow-500 text-slate-900 py-4 rounded-2xl font-black text-lg mt-6 shadow-lg active:scale-95 transition-all">تحديث وحفظ الأوردر ✅</button>
        </div>
      </div>
    </div>
  );
}