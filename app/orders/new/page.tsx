'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, searchProducts, createOrder, getSafes, searchCustomers, checkCustomerPhone } from '@/app/actions';
import { addCustomer } from '@/app/admin-actions'; 
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';

const PIECES_PER_UNIT = 4;

export default function NewOrderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  const [step, setStep] = useState(1);
  const [safes, setSafes] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', phone2: '', code: '', address: '' });
  const [isSavingCust, setIsSavingCust] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});

  const [cart, setCart] = useState<any[]>([]);
  const [cartSearchTerm, setCartSearchTerm] = useState('');
  const [deposit, setDeposit] = useState<string>('');
  const [currency, setCurrency] = useState('EGP'); 
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');
  const [showDiscountOptions, setShowDiscountOptions] = useState(false);

  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // --- FINAL UNSAVED CHANGES WARNING --- 
  useEffect(() => {
    const isDirty = cart.length > 0 && !isSavingOrder;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'لديك تغييرات غير محفوظة. هل أنت متأكد أنك تريد المغادرة؟';
    };

    const handlePopState = () => {
        if (window.confirm("لديك أصناف في السلة لم يتم حفظها. هل تريد الخروج وتجاهل التغييرات؟")) {
            // User confirmed they want to leave. Disable the check and go back.
            window.removeEventListener('popstate', handlePopState);
            router.back();
        } else {
            // User wants to stay. Push the trap state again.
            history.pushState(null, '', pathname);
        }
    };

    if (isDirty) {
      // Set up the trap and listeners only when the cart is dirty
      history.pushState(null, '', pathname);
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // The cleanup function will run when the dependencies change or on unmount
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cart.length, isSavingOrder, pathname, router]);

  // Initial Data Fetching
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

  // Debounced Customer Search
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

  // Debounced Product Search
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
        const isSoldOut = p.status !== 'OPEN' && p.currentStock <= 0;
        if (!isSoldOut) {
            newMap[p.id] = 1; 
        }
    });
    setSelectionMap(newMap);
  };

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
      let existingItemIndex = updatedCart.findIndex(i => i.modelNo === modelNo && i.type === 'product');

      if (existingItemIndex > -1) {
          const existingItem = updatedCart[existingItemIndex];
          const variantsMap: any = {};
          existingItem.variants.forEach((v: any) => { variantsMap[v.productId] = { ...v }; });

          newVariants.forEach((nv: any) => {
              if (variantsMap[nv.id]) variantsMap[nv.id].quantity += nv.qty;
              else variantsMap[nv.id] = { productId: nv.id, quantity: nv.qty, price: nv.price, color: nv.color, productDiscount: nv.discount }; 
          });

          const finalVariants = Object.values(variantsMap);
          const totalQty = finalVariants.reduce((sum: number, v: any) => sum + v.quantity, 0);
          updatedCart[existingItemIndex] = { ...existingItem, totalQty: totalQty, variants: finalVariants };
      } else {
          const finalVariants = newVariants.map((v: any) => ({
              productId: v.id, quantity: v.qty, price: v.price, color: v.color, productDiscount: v.discount 
          }));
          const totalQty = finalVariants.reduce((sum: any, v: any) => sum + v.quantity, 0);
          const originalPrice = newVariants[0].price;
          updatedCart.unshift({
            type: 'product', id: Date.now() + Math.random(), modelNo: modelNo,
            baseDescription: newVariants[0].description, totalQty: totalQty,
            unitPrice: originalPrice, variants: finalVariants
          });
      }
    });

    setCart(updatedCart);
    setSelectionMap({});
    setSearchTerm('');
    setSearchResults([]);
    setShowScanner(false);
  };

  const handleAddDiscount = (percent: number) => {
      if (cart.length > 0 && cart[0].type === 'discount') {
          alert("يوجد خصم مضاف بالفعل في البداية");
          return;
      }
      setCart([{ type: 'discount', percent: percent, id: Date.now(), isAuto: false }, ...cart]);
      setShowDiscountOptions(false);
  };

  const handleApplyAutoProductDiscounts = () => {
    let newCart: any[] = [];
    cart.forEach(item => {
        if(item.type === 'product') {
            const autoPct = item.variants[0]?.productDiscount || 0;
            if(autoPct > 0) {
                newCart.push({ type: 'discount', percent: autoPct, id: 'auto-' + Math.random(), isAuto: true });
                newCart.push(item);
                newCart.push({ type: 'discount', percent: 0, id: 'reset-' + Math.random(), isAuto: true });
            } else {
                newCart.push(item);
            }
        } else if (item.type === 'discount' && !item.isAuto) {
            newCart.push(item);
        }
    });
    setCart(newCart);
    alert("تم تطبيق خصومات الموديلات الموسمية بنجاح ✅");
    setShowDiscountOptions(false);
  };

  const handleEditItem = async (item: any) => {
    if (item.type === 'discount') return;
    const restoredSelection: {[key: string]: number} = {};
    item.variants.forEach((v: any) => { restoredSelection[v.productId] = v.quantity; });
    setSelectionMap(restoredSelection);
    setSearchTerm(item.modelNo);
    setCart(cart.filter(c => c.id !== item.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScan = (code: string) => {
      if (code) { setSearchTerm(code); setShowScanner(false); }
  };

  const getProcessedCart = () => {
      let processedItems: any[] = [];
      let activeDiscount = 0;
      cart.forEach(item => {
          if (item.type === 'discount') activeDiscount = item.percent;
          else {
              const discountedPrice = item.unitPrice * (1 - activeDiscount / 100);
              const totalPrice = item.variants.reduce((sum: number, v: any) => sum + (v.quantity * PIECES_PER_UNIT * discountedPrice), 0);
              processedItems.push({
                  ...item, appliedDiscount: activeDiscount, finalPrice: discountedPrice, totalLinePrice: totalPrice,
                  variants: item.variants.map((v: any) => ({ ...v, price: discountedPrice, discountPercent: activeDiscount }))
              });
          }
      });
      return processedItems; 
  };

  const handleSaveOrder = async () => {
    if(!session?.user) return;
    
    const cleanCart = getProcessedCart();
    const total = cleanCart.reduce((acc, item) => acc + item.totalLinePrice, 0);
    const userId = session.user.image as string; 
    const depositVal = parseFloat(deposit) || 0;
    
    if (!userId) { alert("خطأ هوية"); return; }
    if (depositVal > 0 && !selectedSafeId) { alert("⚠️ يجب اختيار الخزنة!"); return; }
    
    setIsSavingOrder(true); 

    try {
        const result = await createOrder({
          customerId: selectedCustomer.id,
          items: cleanCart, 
          total, 
          deposit: depositVal, 
          safeId: selectedSafeId,
          currency: currency 
        }, userId);

        if (result.success && result.data?.id) {
            router.push(`/orders/${result.data.id}/print`);
        } else {
            alert(result.error || "حدث خطأ أثناء حفظ الأوردر.");
            setIsSavingOrder(false); // Re-enable button on failure
        }
    } catch (error) {
        console.error(error);
        alert("حدث خطأ غير متوقع أثناء الاتصال بالسيرفر.");
        setIsSavingOrder(false); // Re-enable button on failure
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newCust.name) return alert('الاسم مطلوب');
      
      setIsSavingCust(true);

      if (newCust.phone || newCust.phone2) {
          const checkRes = await checkCustomerPhone(newCust.phone || newCust.phone2);
          if (checkRes.exists) {
              const confirmMsg = `⚠️ تنبيه: رقم الهاتف هذا مسجل مسبقاً للعميل:\n\n👤 ${checkRes.name}\n\nهل تريد الاستمرار وإضافة هذا العميل الجديد بنفس الرقم؟`;
              if (!window.confirm(confirmMsg)) {
                  setIsSavingCust(false);
                  return;
              }
          }
      }

      const res = await addCustomer({ ...newCust, source: 'QUICK' });
      
      if (res.warning) {
          setIsSavingCust(false);
          if (confirm(`رقم الهاتف هذا مسجل مسبقاً باسم العميل: (${res.existingName}).\nهل تريد الاستمرار في الإضافة على أي حال؟`)) {
              setIsSavingCust(true);
              const resForce = await addCustomer({ ...newCust, source: 'QUICK', force: true });
              if (resForce.success) {
                  setSelectedCustomer(resForce.customer);
                  setCustomerSearchTerm(resForce.customer.name);
                  setIsQuickAddOpen(false);
                  setNewCust({ name: '', phone: '', phone2: '', code: '', address: '' });
              } else {
                  alert("خطأ: " + resForce.error);
              }
              setIsSavingCust(false);
          }
          return;
      }

      if(res.success) {
          setSelectedCustomer(res.customer);
          setCustomerSearchTerm(res.customer.name);
          setIsQuickAddOpen(false);
          setNewCust({ name: '', phone: '', phone2: '', code: '', address: '' });
      } else {
          alert("خطأ: " + res.error);
      }
      setIsSavingCust(false);
  };

  const processedDisplayCart = getProcessedCart(); 
  const currentTotal = processedDisplayCart.reduce((acc, i) => acc + i.totalLinePrice, 0);
  const depositVal = parseFloat(deposit) || 0;
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
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-500 font-bold">العميل</label>
                <button onClick={() => setIsQuickAddOpen(true)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold">➕ عميل جديد</button>
              </div>
              <div className="relative">
                  <input 
                    type="text" 
                    placeholder="ابحث باسم العميل أو الهاتف..." 
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
                        <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearchTerm(c.name); setShowCustomerList(false); }} 
                             className={`p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 ${c.source === 'QUICK' ? 'bg-purple-50' : ''}`}>
                          <div className="font-bold flex justify-between items-center">
                              <span>{c.name}</span>
                              {c.source === 'QUICK' && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded shadow-sm">جديد ✨</span>}
                          </div>
                          <div className="text-xs text-gray-500">{c.phone} | {c.code}</div>
                        </div>
                      ))
                  ) : (
                      <div className="p-3 text-center text-gray-500 text-xs">لا توجد نتائج (اضغط عميل جديد للإضافة)</div>
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
                        const isSoldOut = prod.status !== 'OPEN' && prod.currentStock <= 0;
                        const isSelected = !!selectionMap[prod.id];
                        const qty = selectionMap[prod.id] || 1;
                        
                        return (
                          <div key={prod.id} className={`p-4 flex items-center justify-between transition-colors ${isSoldOut ? 'bg-gray-100 opacity-60' : (isSelected ? 'bg-blue-50' : 'bg-white')}`}>
                            <div className="flex items-center gap-3 flex-1">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={(e) => toggleSelection(prod.id, e.target.checked)} 
                                disabled={isSoldOut}
                                className="w-6 h-6" 
                              />
                              <div className={isSoldOut ? 'line-through decoration-red-500 decoration-2' : ''}> 
                                  <div className="font-bold">{prod.color}</div>
                                  <div className="text-xs text-gray-500">{prod.price} ج.م | متاح: {prod.currentStock}</div>
                                  {prod.discount > 0 && <div className="text-[10px] text-red-600 font-bold">خصم صنف: {prod.discount}%</div>}
                                  {isSoldOut && <span className="text-[10px] text-red-600 font-bold block">نفذت الكمية</span>}
                              </div>
                            </div>
                            {isSelected && !isSoldOut && (
                              <div className="flex items-center gap-2 bg-white rounded-lg border px-2 py-1 shadow-sm">
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
              <div className="mt-8 animate-fade-in">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 text-lg">محتويات السلة</h3>
                    <div className="relative flex gap-2">
                        <button onClick={handleApplyAutoProductDiscounts} className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] md:text-sm font-bold shadow hover:bg-red-700 animate-pulse">🏷️ خصم الموديلات</button>
                        <button onClick={() => setShowDiscountOptions(!showDiscountOptions)} className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-[10px] md:text-sm font-bold shadow hover:bg-yellow-600">+ خصم مخصص</button>
                        {showDiscountOptions && (
                            <div className="absolute top-full left-0 bg-white border rounded-lg shadow-xl z-20 w-48 mt-1 p-2 grid grid-cols-3 gap-2">
                                {[5, 10, 15, 20, 25, 30, 35, 40, 50, 60].map(p => (
                                    <button key={p} onClick={() => handleAddDiscount(p)} className="bg-gray-100 hover:bg-yellow-100 text-gray-800 text-xs font-bold py-2 rounded">{p}%</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mb-4"><input type="text" placeholder="🔎 بحث سريع داخل محتويات السلة..." value={cartSearchTerm} onChange={(e) => setCartSearchTerm(e.target.value)} className="w-full p-2 border rounded-lg bg-white shadow-sm" /></div>
                
                <div className="space-y-3">
                  {filteredDisplayList.map((item, index) => {
                    if (item.type === 'discount') {
                        return (
                            <div key={item.id} className="bg-yellow-50 border-2 border-yellow-400 border-dashed p-3 rounded-lg flex justify-between items-center">
                                <div className="font-bold text-yellow-800">✂️ خصم {item.percent}% على ما يليه</div>
                                <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-red-500 font-bold bg-white px-2 rounded border border-red-200">حذف</button>
                            </div>
                        );
                    }
                    const processedItem = processedDisplayCart.find((p:any) => p.id === item.id) || item;
                    return (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:border-blue-200">
                            {processedItem.appliedDiscount > 0 && <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-1 rounded-br font-bold">خصم {processedItem.appliedDiscount}%</div>}
                            <div className="flex justify-between mb-2">
                                <div><span className="text-xl font-bold block">{item.modelNo}</span><span className="text-xs text-gray-500">{item.baseDescription}</span></div>
                                <div className="text-left font-bold text-green-700">
                                    {processedItem.appliedDiscount > 0 && <div className="text-xs text-gray-400 line-through">{(processedItem.unitPrice * PIECES_PER_UNIT * processedItem.totalQty).toFixed(0)}</div>}
                                    <span>{processedItem.totalLinePrice?.toFixed(0)} ج.م</span>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2 border border-gray-200">
                                {item.variants.map((v:any, i:number) => (
                                    <span key={i} className="inline-block bg-white px-2 py-1 rounded border mr-1 text-[10px]">{v.quantity} ({v.color})</span>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-xs font-bold text-gray-500">الكمية: {item.totalQty} درزن</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditItem(item)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded font-bold">تعديل ✏️</button>
                                    <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold">حذف 🗑️</button>
                                </div>
                            </div>
                        </div>
                    );
                  })}
                </div>
                
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                    <div className="max-w-2xl mx-auto flex justify-between items-center">
                        <div><span className="text-gray-500 text-xs block">إجمالي الفاتورة</span><span className="text-xl font-black text-green-700">{currentTotal.toFixed(0)} ج.م</span></div>
                        <button onClick={() => setStep(2)} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg">إنهاء ومراجعة ➔</button>
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
              <span className="text-gray-500 font-bold">العميل المختص:</span>
              <span className="font-bold text-blue-800">{selectedCustomer?.name}</span>
            </div>
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto border p-2 rounded bg-slate-50">
              {getProcessedCart().map((item:any, idx) => (
                <div key={idx} className="flex justify-between border-b border-dashed border-gray-300 pb-2 last:border-0 text-sm">
                  <div className="flex-1">
                    <div className="font-bold">{item.modelNo}</div>
                    {item.appliedDiscount > 0 && <span className="text-[10px] text-red-500 font-bold">خصم {item.appliedDiscount}%</span>}
                  </div>
                  <div className="font-bold">{item.totalLinePrice.toFixed(0)} ج.م</div>
                </div>
              ))}
            </div>
            
            <div className="bg-slate-900 text-white p-5 rounded-2xl mb-6 shadow-md">
               <div className="flex justify-between text-lg mb-4 border-b border-slate-700 pb-2"><span>صافي الفاتورة:</span><span className="font-bold text-yellow-400 text-2xl">{currentTotal.toFixed(2)}</span></div>
               <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-2 font-bold">💵 العربون / المدفوع الآن:</label>
                  <div className="flex gap-2">
                     <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-full p-4 rounded-xl bg-slate-800 text-white font-bold text-2xl outline-none border border-slate-700 focus:border-blue-500" placeholder="0.00" />
                     <button onClick={() => setDeposit('')} className="bg-slate-700 text-xs px-4 rounded-lg hover:bg-slate-600 transition text-white font-bold">مسح</button>
                  </div>
               </div>
               
               <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-1 font-bold">العملة:</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full p-3 rounded-xl bg-slate-800 text-white font-bold outline-none border border-slate-700">
                      <option value="EGP">جنيه مصري</option>
                      <option value="USD">دولار أمريكي</option>
                      <option value="SAR">ريال سعودي</option>
                      <option value="KWD">دينار كويتي</option>
                  </select>
               </div>

               {depositVal > 0 && (
                  <div className="mb-4 animate-in slide-in-from-top duration-300">
                     <label className="block text-yellow-400 text-sm mb-2 font-bold">📥 توريد العربون إلى:</label>
                     <select value={selectedSafeId} onChange={(e) => setSelectedSafeId(e.target.value)} className="w-full p-4 rounded-xl bg-slate-800 text-white font-bold text-lg border border-slate-700">
                        {safes.map(safe => (<option key={safe.id} value={safe.id}>{safe.name}</option>))}
                     </select>
                  </div>
               )}
               <div className="flex justify-between text-xl font-bold pt-4 border-t border-slate-700 text-red-400"><span>المتبقي (آجل):</span><span>{(currentTotal - depositVal).toFixed(2)}</span></div>
            </div>
            
            <button 
                onClick={handleSaveOrder} 
                disabled={isSavingOrder}
                className={`w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 ${isSavingOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isSavingOrder ? '⏳ جاري الحفظ والتحقق...' : 'تأكيد وحفظ الأوردر ✅'}
            </button>
            <button onClick={() => setStep(1)} disabled={isSavingOrder} className="w-full mt-4 text-gray-500 font-bold py-2">العودة لتعديل الأصناف</button>
          </div>
        )}
      </div>

      {/* Quick Add Customer Modal */}
      {isQuickAddOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex justify-center items-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-up">
                  <h3 className="font-bold text-lg mb-4 border-b pb-2 text-center text-blue-900">إضافة عميل جديد</h3>
                  <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">اسم العميل (مطلوب)</label><input type="text" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm" required /></div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">كود العميل (تلقائي لو تركته فارغاً)</label><input type="text" value={newCust.code} onChange={e => setNewCust({...newCust, code: e.target.value})} className="w-full border p-3 rounded-xl bg-gray-50 shadow-sm" placeholder="سيتم التوليد تلقائياً" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">هاتف 1</label><input type="text" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">هاتف 2</label><input type="text" value={newCust.phone2} onChange={e => setNewCust({...newCust, phone2: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm bg-yellow-50" /></div>
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label><input type="text" value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="w-full border p-3 rounded-xl shadow-sm" /></div>
                      
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setIsQuickAddOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-lg font-bold transition hover:bg-gray-200">إلغاء</button>
                          <button type="submit" disabled={isSavingCust} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700">حفظ واختيار ✅</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}