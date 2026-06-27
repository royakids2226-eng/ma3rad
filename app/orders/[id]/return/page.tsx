'use client'
import { useState, useEffect, use } from 'react';
import { getOrderById, getSafes, createReturnOrder } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function ReturnOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [safes, setSafes] = useState<any[]>([]);

  // نوع المرتجع
  const [returnType, setReturnType] = useState<'FULL' | 'PARTIAL' | 'EXCHANGE'>('PARTIAL');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // الأصناف المختارة للرجوع
  const [selectedItems, setSelectedItems] = useState<{[key: string]: {
    quantity: number;
    exchangedProductId?: string;
    exchangedQty?: number;
    exchangedPrice?: number;
  }}>({});

  // طريقة الاسترداد
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT' | 'DEDUCT_FROM_NEXT'>('CASH');
  const [selectedSafeId, setSelectedSafeId] = useState('');

  // تحميل البيانات
  useEffect(() => {
    Promise.all([
      getOrderById(id),
      getSafes(),
    ]).then(([orderData, safesData]) => {
      if (!orderData) {
        router.push('/orders/list');
        return;
      }
      setOrder(orderData);
      setSafes(safesData);
      if (safesData.length > 0) {
        const mainSafe = safesData.find(s => s.name === 'الخزنة الرئيسية');
        setSelectedSafeId(mainSafe?.id || safesData[0].id);
      }
      setLoading(false);
    });
  }, [id, router]);

  // تبديل اختيار صنف
  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      const newItems = { ...prev };
      if (newItems[itemId]) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = { quantity: maxQty };
      }
      return newItems;
    });
  };

  // تحديث كمية المرتجع
  const updateQuantity = (itemId: string, qty: number, maxQty: number) => {
    if (qty < 1 || qty > maxQty) return;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: qty },
    }));
  };

  // مرتجع كامل
  const handleFullReturn = () => {
    const allItems: any = {};
    order.items.forEach((item: any) => {
      allItems[item.id] = { quantity: item.quantity };
    });
    setSelectedItems(allItems);
    setReturnType('FULL');
  };

  // الحسابات
  const calculateTotals = () => {
    let totalRefund = 0;
    let exchangeAmount = 0;

    Object.entries(selectedItems).forEach(([itemId, data]) => {
      const orderItem = order.items.find((i: any) => i.id === itemId);
      if (!orderItem) return;

      const refundAmount = data.quantity * orderItem.price;
      totalRefund += refundAmount;

      // لو استبدال
      if (returnType === 'EXCHANGE' && data.exchangedProductId && data.exchangedQty) {
        exchangeAmount += (data.exchangedQty * (data.exchangedPrice || 0)) - refundAmount;
      }
    });

    return { totalRefund, exchangeAmount };
  };

  const { totalRefund, exchangeAmount } = calculateTotals();

  // حفظ المرتجع
  const handleSave = async () => {
    if (Object.keys(selectedItems).length === 0) {
      alert('اختر أصناف للرجوع');
      return;
    }

    if (refundMethod === 'CASH' && !selectedSafeId) {
      alert('اختر الخزنة للاسترداد');
      return;
    }

    setIsSaving(true);

    const items = Object.entries(selectedItems).map(([itemId, data]) => {
      const orderItem = order.items.find((i: any) => i.id === itemId);
      return {
        orderItemId: itemId,
        productId: orderItem.productId,
        quantity: data.quantity,
        unitPrice: orderItem.price,
        refundAmount: data.quantity * orderItem.price,
        exchangedProductId: data.exchangedProductId || null,
        exchangedQty: data.exchangedQty || 0,
        exchangedPrice: data.exchangedPrice || 0,
      };
    });

    const result = await createReturnOrder({
      originalOrderId: order.id,
      type: returnType,
      reason,
      items,
      totalRefund,
      depositRefunded: 0, // يمكن حسابها لاحقاً
      exchangeAmount,
      refundMethod,
      safeId: selectedSafeId,
      notes,
    }, session?.user?.image as string);

    setIsSaving(false);

    if (result.success) {
      alert('✅ تم إنشاء المرتجع بنجاح');
      router.push('/orders/list');
    } else {
      alert('❌ خطأ: ' + result.error);
    }
  };

  if (loading) {
    return <div className="p-10 text-center font-bold">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-red-500">
        <h2 className="font-bold text-lg">↩️ مرتجع أوردر #{order.orderNo}</h2>
        <Link href="/orders/list" className="text-sm text-blue-600 font-bold">
          العودة للقائمة
        </Link>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* معلومات العميل */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-lg text-blue-800">{order.customer.name}</div>
              <div className="text-xs text-gray-500">{order.customer.phone}</div>
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">{order.totalAmount.toFixed(0)} ج.م</div>
              <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</div>
            </div>
          </div>
        </div>

        {/* نوع المرتجع */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-3">نوع المرتجع</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setReturnType('FULL')}
              className={`p-3 rounded-lg font-bold text-sm border-2 transition-all ${
                returnType === 'FULL'
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              🔴 مرتجع كامل
            </button>
            <button
              onClick={() => setReturnType('PARTIAL')}
              className={`p-3 rounded-lg font-bold text-sm border-2 transition-all ${
                returnType === 'PARTIAL'
                  ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              🟡 مرتجع جزئي
            </button>
            <button
              onClick={() => setReturnType('EXCHANGE')}
              className={`p-3 rounded-lg font-bold text-sm border-2 transition-all ${
                returnType === 'EXCHANGE'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              🔵 استبدال
            </button>
          </div>
          {returnType === 'FULL' && (
            <button
              onClick={handleFullReturn}
              className="mt-3 w-full bg-red-100 text-red-700 py-2 rounded-lg font-bold text-sm"
            >
              تحديد كل الأصناف
            </button>
          )}
        </div>

        {/* الأصناف */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-3">الأصناف</h3>
          <div className="space-y-2">
            {order.items.map((item: any) => {
              const isSelected = !!selectedItems[item.id];
              const selectedData = selectedItems[item.id];
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item.id, item.quantity)}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-bold">{item.product.modelNo}</div>
                        <div className="text-xs text-gray-500">
                          {item.product.color} - {item.price} ج.م
                        </div>
                      </div>
                    </div>
                    <div className="text-left font-bold">
                      {item.quantity} قطعة
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs font-bold text-gray-600">الكمية:</label>
                      <input
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={selectedData?.quantity || 1}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1, item.quantity)}
                        className="w-20 p-2 border rounded text-center font-bold"
                      />
                      <span className="text-xs text-gray-500">
                        = {(selectedData?.quantity || 0) * item.price} ج.م
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* طريقة الاسترداد */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-3">طريقة الاسترداد</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => setRefundMethod('CASH')}
              className={`p-3 rounded-lg font-bold text-sm border-2 ${
                refundMethod === 'CASH'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              💵 نقدي
            </button>
            <button
              onClick={() => setRefundMethod('CREDIT')}
              className={`p-3 rounded-lg font-bold text-sm border-2 ${
                refundMethod === 'CREDIT'
                  ? 'bg-purple-50 border-purple-500 text-purple-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              📝 Credit
            </button>
            <button
              onClick={() => setRefundMethod('DEDUCT_FROM_NEXT')}
              className={`p-3 rounded-lg font-bold text-sm border-2 ${
                refundMethod === 'DEDUCT_FROM_NEXT'
                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              ⚖️ خصم قادم
            </button>
          </div>

          {refundMethod === 'CASH' && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">الخزنة:</label>
              <select
                value={selectedSafeId}
                onChange={(e) => setSelectedSafeId(e.target.value)}
                className="w-full p-3 border rounded-lg font-bold"
              >
                {safes.map((safe) => (
                  <option key={safe.id} value={safe.id}>
                    {safe.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* السبب والملاحظات */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="text-xs font-bold text-gray-600 mb-1 block">سبب المرتجع:</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: عيب في الصنع، عدم ملاءمة..."
            className="w-full p-3 border rounded-lg mb-3"
          />
          <label className="text-xs font-bold text-gray-600 mb-1 block">ملاحظات:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 border rounded-lg"
            rows={3}
          />
        </div>

        {/* الحسابات */}
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <span>إجمالي المرتجع:</span>
            <span className="font-bold text-2xl text-yellow-400">{totalRefund.toFixed(2)} ج.م</span>
          </div>
          {returnType === 'EXCHANGE' && exchangeAmount !== 0 && (
            <div className="flex justify-between items-center mb-2 text-sm">
              <span>فرق الاستبدال:</span>
              <span className={`font-bold ${exchangeAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {exchangeAmount > 0 ? '+' : ''}{exchangeAmount.toFixed(2)} ج.م
              </span>
            </div>
          )}
        </div>

        {/* زر الحفظ */}
        <button
          onClick={handleSave}
          disabled={isSaving || Object.keys(selectedItems).length === 0}
          className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-lg shadow-xl disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSaving ? '⏳ جاري الحفظ...' : '↩️ تأكيد المرتجع'}
        </button>
      </div>
    </div>
  );
}
