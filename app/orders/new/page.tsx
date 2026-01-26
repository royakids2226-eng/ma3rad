'use client'
import { useState, useEffect, useRef } from 'react';
import { getCustomers, searchProducts, createOrder, getSafes } from '@/app/actions';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';

const PIECES_PER_UNIT = 4;

export default function NewOrderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // States
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<any[]>([]);
  const [safes, setSafes] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  // 👇 حالات البحث الجديد للعملاء
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const customerListRef = useRef<HTMLDivElement>(null); // لإغلاق القائمة عند الضغط خارجها

  // Search & Scanner States
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectionMap, setSelectionMap] = useState<{[key: string]: number}>({});

  // Cart & Finance
  const [cart, setCart] = useState<any[]>([]);
  const [cartSearchTerm, setCartSearchTerm] = useState(''); // 👈 حالة البحث داخل السلة
  const [deposit, setDeposit] = useState<string>('');
  const [selectedSafeId, setSelectedSafeId] = useState<string>('');

  // 1. Load Data
  useEffect(() => {
    getCustomers().then(setCustomers);
    getSafes().then(data => {
      setSafes(data);
      if (data.length > 0) setSelectedSafeId(data[0].id);
    });

    // إغلاق قائمة العملاء عند الضغط في أي مكان آخر
    const handleClickOutside = (event: MouseEvent) => {
      if (customerListRef.current && !customerListRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 2. Live Search Logic (Products)
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

  // Handlers
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
    searchResults.forEach(p => { newMap[p.id] = 1; });
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
      const existingItemIndex = updatedCart.findIndex(item => item.modelNo === modelNo);

      let finalVariants: any[] = [];
      let baseItemData = newVariants[0];

      if (existingItemIndex > -1) {
        const existingItem = updatedCart[existingItemIndex];
        updatedCart.splice(existingItemIndex, 1);
        const variantsMap: {[key: string]: any} = {};
        existingItem.variants.forEach((v: any) => { variantsMap[v.productId] = { ...v }; });
        newVariants.forEach((v: any) => {
          if (variantsMap[v.id]) variantsMap[v.id].quantity += v.qty;
          else variantsMap[v.id] = { productId: v.id, quantity: v.qty, price: v.price, color: v.color };
        });
        finalVariants = Object.values(variantsMap);
      } else {
        finalVariants = newVariants.map((v: any) => ({
          productId: v.id, quantity: v.qty, price: v.price, color: v.color
        }));
      }

      const totalQty = finalVariants.reduce((sum, v) => sum + v.quantity, 0);
      const totalPrice = finalVariants.reduce((sum, v) => sum + (v.quantity * PIECES_PER_UNIT * v.price), 0);
      const colorsDescription = finalVariants.map(v => `${v.quantity} (${v.color})`).join(' + ');

      updatedCart.unshift({
        id: existingItemIndex > -1 ? Date.now() : (Date.now() + Math.random()),
        modelNo: modelNo,
        baseDescription: baseItemData.description,
        displayDescription: `${baseItemData.description || ''} [ ${colorsDescription} ]`,
        totalQty: totalQty,
        price: baseItemData.price,
        totalPrice: totalPrice,
        variants: finalVariants
      });
    });

    setCart(updatedCart);
    setSelectionMap({});
    setSearchTerm('');
    setSearchResults([]);
    setShowScanner(false);
  };

  const handleEditItem = async (item: any) => {
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

  const handleSaveOrder = async () => {
    if(!session?.user) return;
    
    const total = cart.reduce((acc, item) => acc + item.totalPrice, 0);
    const userId = session.user.image as string; 
    const depositVal = parseFloat(deposit) || 0;

    if (!userId) {
        alert("خطأ: لم يتم التعرف على هوية الموظف.");
        return;
    }

    if (depositVal > 0 && !selectedSafeId) {
        alert("⚠️ يجب اختيار الخزنة!");
        return;
    }

    const newOrder = await createOrder({
      customerId: selectedCustomer.id,
      items: cart,
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

  const currentTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const depositVal = parseFloat(deposit) || 0;

  // 👇 فلترة العملاء بناءً على البحث
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  // 👇 فلترة السلة بناءً على بحث الأصناف
  const filteredCart = cart.filter(item => 
    item.modelNo.toLowerCase().includes(cartSearchTerm.toLowerCase()) ||
    item.displayDescription.toLowerCase().includes(cartSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center">
        <h2 className="font-bold text-lg">
          {step === 1 ? '🛒 أوردر جديد' : '💰 الدفع والحفظ'}
        </h2>
        {step === 2 && (
          <button onClick={() => setStep(1)} className="text-sm text-blue-600 font-bold">تعديل الأصناف</button>
        )}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {step === 1 && (
          <>
            {/* 👇 قسم اختيار العميل (Live Search) */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100 relative" ref={customerListRef}>
              <label className="text-sm text-gray-500 font-bold mb-2 block">العميل</label>
              
              <input 
                type="text"
                placeholder="ابحث عن اسم العميل..."
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setShowCustomerList(true);
                  if (e.target.value === '') setSelectedCustomer(null);
                }}
                onFocus={() => setShowCustomerList(true)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />

              {/* قائمة العملاء المقترحة */}
              {showCustomerList && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearchTerm(c.name);
                        setShowCustomerList(false);
                      }}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                    >
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone || 'لا يوجد هاتف'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="animate-fade-in">
                
                {/* Scanner Modal */}
                {showScanner && (
                    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-white rounded-xl overflow-hidden relative">
                            <button 
                                onClick={() => setShowScanner(false)}
                                className="absolute top-2 right-2 z-10 bg-red-600 text-white w-8 h-8 rounded-full font-bold"
                            >X</button>
                            <h3 className="text-center p-2 font-bold bg-gray-100">وجه الكاميرا للكود</h3>
                            <Scanner 
                                onScan={(result) => {
                                    if(result && result.length > 0) handleScan(result[0].rawValue);
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Product Search Input */}
                <div className="relative mb-4 flex gap-2">
                  <div className="relative flex-1">
                    <input 
                        type="text" 
                        placeholder="🔍 ابحث برقم الموديل لإضافته..." 
                        className="w-full p-4 pl-12 border rounded-xl shadow-sm text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                  </div>
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="bg-black text-white p-4 rounded-xl shadow-sm hover:bg-gray-800 transition"
                  >
                    📷
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                     <div className="bg-gray-100 p-3 flex justify-between items-center border-b">
                      <span className="font-bold text-gray-700">موديل: {searchResults[0]?.modelNo}</span>
                      <button onClick={handleSelectAll} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">تحديد الكل</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {searchResults.map(prod => {
                        const isSelected = !!selectionMap[prod.id];
                        const qty = selectionMap[prod.id] || 1;
                        return (
                          <div key={prod.id} className={`p-4 flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                            <div className="flex items-center gap-3 flex-1">
                              <input type="checkbox" checked={isSelected} onChange={(e) => toggleSelection(prod.id, e.target.checked)} className="w-6 h-6" />
                              <div><div className="font-bold">{prod.color}</div><div className="text-xs text-gray-500">{prod.price} ج.م</div></div>
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

            {/* Cart Section */}
            {cart.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-gray-700 mb-3 text-lg">محتويات السلة</h3>
                
                {/* 👇 حقل البحث داخل السلة (الجديد) */}
                <div className="mb-4">
                  <input 
                    type="text" 
                    placeholder="🔎 تصفية / بحث داخل السلة..." 
                    value={cartSearchTerm}
                    onChange={(e) => setCartSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                  />
                </div>

                <div className="space-y-3">
                  {filteredCart.length === 0 && <p className="text-gray-400 text-center text-sm">لا يوجد نتائج للبحث</p>}
                  
                  {filteredCart.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex justify-between mb-2">
                        <div><span className="text-xl font-bold block">{item.modelNo}</span><span className="text-xs text-gray-500">{item.baseDescription}</span></div>
                        <div className="text-left"><span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded-full font-bold block">{item.totalPrice.toFixed(0)} ج.م</span></div>
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2 border border-gray-200">{item.displayDescription.split('[').map((part:string, i:number) => (i === 1 ? <span key={i} className="font-bold text-blue-700 block mt-1">{part.replace(']', '')}</span> : ''))}</div>
                      <div className="flex justify-between items-center pt-2 border-t gap-2">
                         <span className="text-sm font-bold">العدد: {item.totalQty}</span>
                         <div className="flex gap-2">
                            <button onClick={() => handleEditItem(item)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-2 rounded font-bold">تعديل ✏️</button>
                            <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded font-bold">حذف 🗑️</button>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep(2)} className="w-full mt-6 bg-green-600 text-white py-4 rounded-xl font-bold text-xl shadow-lg fixed bottom-4 left-0 right-0 max-w-2xl mx-auto z-30">مراجعة وإنهاء ({cart.length})</button>
                <div className="h-20"></div>
              </div>
            )}
          </>
        )}

        {/* STEP 2: Review & Finance */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
            <h3 className="text-center font-bold text-xl mb-6 border-b pb-4">مراجعة الحساب</h3>
            
            <div className="flex justify-between mb-4 text-sm bg-gray-50 p-3 rounded">
              <span className="text-gray-500">العميل:</span>
              <span className="font-bold">{selectedCustomer?.name}</span>
            </div>
            
            <div className="space-y-4 mb-6 max-h-40 overflow-y-auto border p-2 rounded">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between border-b border-dashed border-gray-300 pb-2 last:border-0 text-sm">
                  <div className="flex-1">
                    <div className="font-bold">{item.modelNo}</div>
                    <div className="text-xs text-gray-500">{item.displayDescription.replace(/.*\[/, '').replace(']', '')}</div>
                  </div>
                  <div className="font-bold">{item.totalPrice}</div>
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
                     <input 
                        type="number" 
                        value={deposit}
                        onChange={(e) => setDeposit(e.target.value)}
                        className="w-full p-3 rounded-lg bg-white text-black font-bold text-2xl outline-none border-2 border-transparent focus:border-blue-500 placeholder-gray-300"
                        placeholder="0.00"
                     />
                     <button 
                        onClick={() => setDeposit('')}
                        className="bg-gray-700 text-xs px-4 rounded-lg hover:bg-gray-600 transition text-white font-bold"
                     >
                        مسح
                     </button>
                  </div>
               </div>

               {/* Safe Select */}
               {depositVal > 0 && (
                  <div className="mb-4 animate-fade-in">
                     <label className="block text-yellow-400 text-sm mb-2 font-bold">📥 توريد العربون إلى:</label>
                     <select 
                        value={selectedSafeId}
                        onChange={(e) => setSelectedSafeId(e.target.value)}
                        className="w-full p-3 rounded-lg bg-white text-black text-lg outline-none focus:ring-2 focus:ring-yellow-500 border-2 border-yellow-600"
                     >
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

            <button 
              onClick={handleSaveOrder}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg"
            >
              تأكيد وحفظ الأوردر ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}