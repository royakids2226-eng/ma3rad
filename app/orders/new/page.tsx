'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, searchProducts, createOrder, getSafes, searchCustomers } from '@/app/actions';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';

const PIECES_PER_UNIT = 4;

export default function NewOrderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [safes, setSafes] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  // Customer Search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null);

  // Product Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});

  // Cart & Discount Logic
  // السلة الآن يمكن أن تحتوي على منتجات أو "فواصل خصم"
  const [cart, setCart] = useState<any[]>([]);
  const [cartSearchTerm, setCartSearchTerm] = useState('');
  const [deposit, setDeposit] = useState<string>('');
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');
  const [showDiscountOptions, setShowDiscountOptions] = useState(false); // لإظهار قائمة الخصومات

  useEffect(() => {
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

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        const results = await searchProducts(searchTerm);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const toggleSelection = (productId: string, isChecked: boolean) => {
    setSelectionMap(prev => {
      const newMap = { ...prev };
      if (isChecked) newMap[productId] = 1; else delete newMap[productId];
      return newMap;
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    setSelectionMap(prev => ({ ...prev, [productId]: newQty }));
  };

  const handleSelectAll = () => {
    const newMap: {[key: string]: number} = {};
    searchResults.forEach(p => { 
        if (!(p.status === 'CLOSED' && p.stockQty <= 0)) {
            newMap[p.id] = 1; 
        }
    });
    setSelectionMap(newMap);
  };

  // Add Products to Cart
  const handleAddToCart = () => {
    const selectedIds = Object.keys(selectionMap);
    if (selectedIds.length === 0) return;

    const selectedProducts = searchResults.filter(p => selectedIds.includes(p.id));
    const groupedByModel: {[key: string]: any[]} = {};
    selectedProducts.forEach(p => {
      if (!groupedByModel[p.modelNo]) groupedByModel[p.modelNo] = [];
      groupedByModel[p.modelNo].push({ ...p, qty: selectionMap[p.id] });
    });

    let updatedCart = [...cart];

    Object.keys(groupedByModel).forEach(modelNo => {
      const newVariants = groupedByModel[modelNo];
      
      const finalVariants = newVariants.map((v: any) => ({
          productId: v.id, quantity: v.qty, price: v.price, color: v.color
      }));

      const totalQty = finalVariants.reduce((sum, v) => sum + v.quantity, 0);
      const originalPrice = finalVariants[0].price; // السعر الأصلي للقطعة
      // ملاحظة: السعر سيتم حسابه لاحقاً بناءً على الخصم

      updatedCart.unshift({
        type: 'product', // 👈 تمييز النوع
        id: Date.now() + Math.random(),
        modelNo: modelNo,
        baseDescription: newVariants[0].description,
        totalQty: totalQty,
        unitPrice: originalPrice,
        variants: finalVariants
      });
    });

    setCart(updatedCart);
    setSelectionMap({});
    setSearchTerm('');
    setSearchResults([]);
    setShowScanner(false);
  };

  // 👇 إضافة خصم جديد (كسطر فاصل)
  const handleAddDiscount = (percent: number) => {
      // نتأكد أن السطر الأول ليس خصماً بالفعل (لتجنب التكرار غير المنطقي)
      if (cart.length > 0 && cart[0].type === 'discount') {
          alert("يوجد خصم مضاف بالفعل في البداية");
          return;
      }

      setCart([
          { type: 'discount', percent: percent, id: Date.now() },
          ...cart
      ]);
      setShowDiscountOptions(false);
  };

  const handleEditItem = async (item: any) => {
    if (item.type === 'discount') return; // لا يمكن تعديل الخصم (احذفه وأضفه)

    setSearchTerm(item.modelNo);
    const results = await searchProducts(item.modelNo);
    setSearchResults(results);
    const restoredSelection: {[key: string]: number} = {};
    item.variants.forEach((v: any) => { restoredSelection[v.productId] = v.quantity; });
    setSelectionMap(restoredSelection);
    setCart(cart.filter(c => c.id !== item.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScan = (code: string) => {
      if (code) {
          setSearchTerm(code);
          setShowScanner(false);
      }
  };

  // 👇 المنطق الذكي لحساب الإجمالي وتوزيع الخصومات
  // هذه الدالة تعيد قائمة المنتجات النهائية مع أسعارها بعد الخصم (للعرض وللحفظ)
  const getProcessedCart = () => {
      let processedItems: any[] = [];
      // نبدأ من الأسفل للأعلى (من الأقدم للأحدث) لأن الخصم يطبق على "السطور السابقة"
      // لكن المصفوفة cart مرتبة (الأحدث في index 0).
      // لذا سنعكس المصفوفة مؤقتاً لنحاكي الترتيب الزمني للإضافة
      const chronologicalCart = [...cart].reverse(); 

      let currentDiscount = 0; // الخصم النشط الحالي

      // نمشي من الأقدم للأحدث
      // إذا وجدنا خصم، نحدث قيمة currentDiscount
      // إذا وجدنا منتج، نطبق عليه currentDiscount
      // لكن الطلب: "عند اختيار الخصم يطبق على السطور السابقة فقط"
      // هذا يعني في المصفوفة المعكوسة (الزمنية): المنتج يضاف أولاً، ثم يضاف الخصم لاحقاً ليؤثر عليه.
      // إذن: نمشي من "الآخِر" (الأحدث، وهو الخصم) ونطبق على ما قبله؟
      // لا، الأسهل: نمشي في الـ cart الأصلية (حيث index 0 هو الأحدث).
      // إذا وجدنا خصم في index 0، فهو يطبق على index 1, 2, 3... حتى نجد خصم آخر.
      
      let activeDiscount = 0;

      // نمر على عناصر السلة (من الأحدث للأقدم)
      cart.forEach(item => {
          if (item.type === 'discount') {
              activeDiscount = item.percent; // تغيير نسبة الخصم للأسطر التالية (الأقدم)
          } else {
              // هذا منتج، نطبق عليه الخصم النشط حالياً
              const discountVal = activeDiscount;
              const unitPrice = item.unitPrice;
              const discountedPrice = unitPrice * (1 - discountVal / 100);
              const totalPrice = item.variants.reduce((sum: number, v: any) => sum + (v.quantity * PIECES_PER_UNIT * discountedPrice), 0);
              
              // نضيف تفاصيل الخصم للمنتج
              processedItems.push({
                  ...item,
                  appliedDiscount: discountVal,
                  finalPrice: discountedPrice,
                  totalLinePrice: totalPrice,
                  // تحديث الفارينتس بالسعر الجديد
                  variants: item.variants.map((v: any) => ({
                      ...v,
                      price: discountedPrice,
                      discountPercent: discountVal
                  }))
              });
          }
      });

      return processedItems; // هذه القائمة تحتوي المنتجات فقط مع الأسعار النهائية
  };

  const handleSaveOrder = async () => {
    if(!session?.user) return;
    
    // تحويل السلة المختلطة إلى سلة منتجات صافية بأسعار نهائية
    const cleanCart = getProcessedCart();
    
    const total = cleanCart.reduce((acc, item) => acc + item.totalLinePrice, 0);
    const userId = session.user.image as string; 
    const depositVal = parseFloat(deposit) || 0;

    if (!userId) { alert("خطأ هوية"); return; }
    if (depositVal > 0 && !selectedSafeId) { alert("⚠️ يجب اختيار الخزنة!"); return; }

    const newOrder = await createOrder({
      customerId: selectedCustomer.id,
      items: cleanCart, // نرسل القائمة النظيفة
      total,
      deposit: depositVal,
      safeId: selectedSafeId
    }, userId);

    if (newOrder && newOrder.id) {
        router.push(`/orders/${newOrder.id}/print`);
    } else {
        alert("حدث خطأ أثناء حفظ الأوردر.");
    }
  };

  // للحسابات في الواجهة
  const processedDisplayCart = getProcessedCart(); 
  const currentTotal = processedDisplayCart.reduce((acc, i) => acc + i.totalLinePrice, 0);
  const depositVal = parseFloat(deposit) || 0;

  // الفلترة للعرض فقط (مع الحفاظ على الفواصل)
  const filteredDisplayList = cart.filter(item => {
      if (item.type === 'discount') return true;
      return item.modelNo.toLowerCase().includes(cartSearchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center">
        <h2 className="font-bold text-lg">{step === 1 ? '🛒 أوردر جديد' : '💰 الدفع والحفظ'}</h2>
        {step === 2 && <button onClick={() => setStep(1)} className="text-sm text-blue-600 font-bold">تعديل الأصناف</button>}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {step === 1 && (
          <>
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100 relative" ref={customerListRef}>
              <label className="text-sm text-gray-500 font-bold mb-2 block">العميل</label>
              <div className="relative">
                  <input 
                    type="text" 
                    placeholder="ابحث باسم العميل (بدون همزات) أو الهاتف..." 
                    value={customerSearchTerm} 
                    onChange={(e) => { 
                        setCustomerSearchTerm(e.target.value); 
                        setShowCustomerList(true); 
                        if (e.target.value === '') setSelectedCustomer(null); 
                    }} 
                    onFocus={() => setShowCustomerList(true)} 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  {isSearchingCustomer && <span className="absolute left-3 top-3 text-gray-400 text-xs">جاري البحث...</span>}
              </div>

              {showCustomerList && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-b-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {customerResults.length > 0 ? (
                      customerResults.map(c => (
                        <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearchTerm(c.name); setShowCustomerList(false); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
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

            {selectedCustomer && (
              <div className="animate-fade-in">
                {showScanner && <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white rounded-xl overflow-hidden relative"><button onClick={() => setShowScanner(false)} className="absolute top-2 right-2 bg-red-600 text-white w-8 h-8 rounded-full font-bold">X</button><Scanner onScan={(result) => { if(result && result.length > 0) handleScan(result[0].rawValue); }} /></div></div>}
                
                <div className="relative mb-4 flex gap-2">
                  <input type="text" placeholder="🔍 ابحث برقم الموديل..." className="flex-1 p-4 pl-12 border rounded-xl shadow-sm text-lg focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                  <button onClick={() => setShowScanner(true)} className="bg-black text-white p-4 rounded-xl shadow-sm">📷</button>
                </div>

                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                     <div className="bg-gray-100 p-3 flex justify-between items-center border-b">
                      <span className="font-bold text-gray-700">موديل: {searchResults[0]?.modelNo}</span>
                      <button onClick={handleSelectAll} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">تحديد الكل</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {searchResults.map(prod => {
                        const isClosedAndEmpty = prod.status === 'CLOSED' && prod.stockQty <= 0;
                        const isSelected = !!selectionMap[prod.id];
                        const qty = selectionMap[prod.id] || 1;

                        return (
                          <div key={prod.id} className={`p-4 flex items-center justify-between transition-colors ${isClosedAndEmpty ? 'bg-gray-100 opacity-60' : (isSelected ? 'bg-blue-50' : 'bg-white')}`}>
                            <div className="flex items-center gap-3 flex-1">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={(e) => toggleSelection(prod.id, e.target.checked)} 
                                disabled={isClosedAndEmpty} 
                                className="w-6 h-6 disabled:cursor-not-allowed" 
                              />
                              <div>
                                  <div className="font-bold">{prod.color}</div>
                                  <div className="text-xs text-gray-500">
                                      {prod.price} ج.م | متاح: {prod.stockQty} 
                                      {isClosedAndEmpty && <span className="text-red-500 font-bold mr-1">(غير متاح)</span>}
                                  </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-2 bg-white rounded-lg border px-2 py-1">
                                <button onClick={() => updateQuantity(prod.id, qty + 1)} className="w-8 h-8 bg-gray-200 rounded font-bold">+</button>
                                <input type="number" value={qty} onChange={(e) => updateQuantity(prod.id, parseInt(e.target.value) || 1)} className="w-10 text-center font-bold outline-none" />
                                <button onClick={() => updateQuantity(prod.id, qty - 1)} className="w-8 h-8 bg-gray-200 rounded font-bold">-</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-3 bg-gray-50 border-t text-center">
                      <button onClick={handleAddToCart} disabled={Object.keys(selectionMap).length === 0} className="w-full bg-black text-white py-3 rounded-lg font-bold disabled:opacity-50">إضافة للسلة</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 text-lg">محتويات السلة</h3>
                    {/* 👇 زر إضافة الخصم */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowDiscountOptions(!showDiscountOptions)} 
                            className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-sm font-bold shadow hover:bg-yellow-600"
                        >
                            + إضافة خصم 🏷️
                        </button>
                        
                        {/* قائمة الخصومات */}
                        {showDiscountOptions && (
                            <div className="absolute top-full left-0 bg-white border rounded-lg shadow-xl z-20 w-48 mt-1 p-2 grid grid-cols-3 gap-2">
                                {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => handleAddDiscount(p)}
                                        className="bg-gray-100 hover:bg-yellow-100 text-gray-800 text-xs font-bold py-2 rounded"
                                    >
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-4"><input type="text" placeholder="🔎 بحث..." value={cartSearchTerm} onChange={(e) => setCartSearchTerm(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50" /></div>
                
                <div className="space-y-3">
                  {/* نقوم بعرض العناصر مع حساب السعر النهائي "للعرض فقط" */}
                  {/* هنا نستخدم filteredDisplayList لكن نحتاج لحساب القيم لها */}
                  {filteredDisplayList.map((item, index) => {
                    if (item.type === 'discount') {
                        return (
                            <div key={item.id} className="bg-yellow-50 border-2 border-yellow-400 border-dashed p-3 rounded-lg flex justify-between items-center">
                                <div className="font-bold text-yellow-800">✂️ خصم {item.percent}% على ما سبق</div>
                                <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-red-500 font-bold bg-white px-2 rounded border border-red-200">حذف</button>
                            </div>
                        );
                    }

                    // البحث عن العنصر المعالج (المحتوي على السعر النهائي)
                    const processedItem = processedDisplayCart.find((p:any) => p.id === item.id) || item;

                    return (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                            {/* شارة الخصم */}
                            {processedItem.appliedDiscount > 0 && (
                                <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-1 rounded-br font-bold">
                                    خصم {processedItem.appliedDiscount}%
                                </div>
                            )}

                            <div className="flex justify-between mb-2">
                                <div><span className="text-xl font-bold block">{item.modelNo}</span><span className="text-xs text-gray-500">{item.baseDescription}</span></div>
                                <div className="text-left">
                                    {processedItem.appliedDiscount > 0 && (
                                        <div className="text-xs text-gray-400 line-through">{(processedItem.unitPrice * PIECES_PER_UNIT * processedItem.totalQty).toFixed(0)}</div>
                                    )}
                                    <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded-full font-bold block">
                                        {processedItem.totalLinePrice?.toFixed(0)} ج.م
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2 border border-gray-200">
                                {item.variants.map((v:any, i:number) => (
                                    <span key={i} className="inline-block bg-white px-2 py-1 rounded border mr-1 text-xs">
                                        {v.quantity} ({v.color})
                                    </span>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t gap-2">
                                <span className="text-sm font-bold">العدد: {item.totalQty}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditItem(item)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-2 rounded font-bold">تعديل ✏️</button>
                                    <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded font-bold">حذف 🗑️</button>
                                </div>
                            </div>
                        </div>
                    );
                  })}
                </div>
                
                {/* Total Bar */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div className="max-w-2xl mx-auto flex justify-between items-center">
                        <div>
                            <span className="text-gray-500 text-sm block">الإجمالي النهائي</span>
                            <span className="text-xl font-bold text-green-700">{currentTotal.toFixed(0)} ج.م</span>
                        </div>
                        <button onClick={() => setStep(2)} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg shadow hover:bg-green-700">
                            إنهاء ({processedDisplayCart.length})
                        </button>
                    </div>
                </div>
                <div className="h-20"></div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
            <h3 className="text-center font-bold text-xl mb-6 border-b pb-4">مراجعة الحساب</h3>
            
            <div className="flex justify-between mb-4 text-sm bg-gray-50 p-3 rounded">
              <span className="text-gray-500">العميل:</span>
              <span className="font-bold">{selectedCustomer?.name}</span>
            </div>
            
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto border p-2 rounded">
              {getProcessedCart().map((item:any, idx) => (
                <div key={idx} className="flex justify-between border-b border-dashed border-gray-300 pb-2 last:border-0 text-sm">
                  <div className="flex-1">
                    <div className="font-bold">{item.modelNo}</div>
                    {item.appliedDiscount > 0 && <span className="text-xs text-red-500 font-bold">خصم {item.appliedDiscount}%</span>}
                  </div>
                  <div className="font-bold">{item.totalLinePrice.toFixed(0)}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-xl mb-6 shadow-md">
               <div className="flex justify-between text-lg mb-4 border-b border-gray-700 pb-2">
                  <span>إجمالي الفاتورة:</span>
                  <span className="font-bold">{currentTotal.toFixed(2)}</span>
               </div>
               
               <div className="mb-4">
                  <label className="block text-gray-300 text-sm mb-2 font-bold">💵 العربون (المدفوع الآن):</label>
                  <div className="flex gap-2">
                     <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-full p-3 rounded-lg bg-white text-black font-bold text-2xl outline-none border-2 border-transparent focus:border-blue-500 placeholder-gray-300" placeholder="0.00" />
                     <button onClick={() => setDeposit('')} className="bg-gray-700 text-xs px-4 rounded-lg hover:bg-gray-600 transition text-white font-bold">مسح</button>
                  </div>
               </div>

               {depositVal > 0 && (
                  <div className="mb-4 animate-fade-in">
                     <label className="block text-yellow-400 text-sm mb-2 font-bold">📥 توريد العربون إلى:</label>
                     <select value={selectedSafeId} onChange={(e) => setSelectedSafeId(e.target.value)} className="w-full p-3 rounded-lg bg-white text-black text-lg outline-none focus:ring-2 focus:ring-yellow-500 border-2 border-yellow-600">
                        {safes.map(safe => (
                          <option key={safe.id} value={safe.id}>{safe.name}</option>
                        ))}
                     </select>
                  </div>
               )}

               <div className="flex justify-between text-2xl font-bold pt-2 text-yellow-400 border-t border-gray-700 mt-4">
                  <span>المتبقي (آجل):</span>
                  <span>{(currentTotal - depositVal).toFixed(2)}</span>
               </div>
            </div>

            <button onClick={handleSaveOrder} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg">تأكيد وحفظ الأوردر ✅</button>
          </div>
        )}
      </div>
    </div>
  );
}