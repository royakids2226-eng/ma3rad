'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReturnById, updateReturnOrder } from '@/app/actions';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Define a type for the result of server actions
type ActionResult = { success: boolean; error?: string };

export default function EditReturnPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [returnOrder, setReturnOrder] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [availableToAddItems, setAvailableToAddItems] = useState<any[]>([]);
  const [totalRefund, setTotalRefund] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getReturnById(id)
        .then(data => {
          if (data) {
            // ... (error checks for cancelled/exchange orders) ...
            setReturnOrder(data);
            setReason(data.reason || '');
            setNotes(data.notes || '');

            const currentReturnItems = data.items.map((item: any) => {
                const originalOrderItem = data.originalOrder.items.find((oi: any) => oi.id === item.orderItemId);
                return { ...item, maxQuantity: originalOrderItem.quantity };
            });
            setItems(currentReturnItems);

            const returnedOrderItemIds = new Set(data.items.map((i: any) => i.orderItemId));
            const available = data.originalOrder.items
                .filter((oi: any) => !returnedOrderItemIds.has(oi.id))
                .map((oi: any) => ({ ...oi, addQuantity: 0 }));
            setAvailableToAddItems(available);

          } else { /* ... error handling ... */ }
          setLoading(false);
        })
        .catch(() => { /* ... error handling ... */ });
    }
  }, [id, router]);

  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    setTotalRefund(newTotal);
  }, [items]);

  const handleQuantityChange = (itemId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    setItems(items.map(item => {
        if (item.id === itemId) {
            if (isNaN(newQuantity) || newQuantity < 0 || newQuantity > item.maxQuantity) {
                toast.error(`الكمية يجب أن تكون بين 0 و ${item.maxQuantity}`);
                return item; // return original item if invalid
            }
            return { ...item, quantity: newQuantity };
        }
        return item;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    const itemToRemove = items.find(i => i.id === itemId);
    if (!itemToRemove) return;

    const originalOrderItem = returnOrder.originalOrder.items.find((oi: any) => oi.id === itemToRemove.orderItemId);
    setItems(items.filter(item => item.id !== itemId));
    if (originalOrderItem) {
        setAvailableToAddItems([...availableToAddItems, { ...originalOrderItem, addQuantity: 0 }]);
    }
  };

  const handleAddQuantityChange = (orderItemId: string, addQuantityStr: string) => {
    const addQuantity = parseInt(addQuantityStr, 10);
    setAvailableToAddItems(availableToAddItems.map(item => {
        if (item.id === orderItemId) {
            if (isNaN(addQuantity) || addQuantity < 0 || addQuantity > item.quantity) {
                toast.error(`الكمية للإضافة يجب أن تكون بين 0 و ${item.quantity}`);
                return item; // return original item if invalid
            }
            return { ...item, addQuantity };
        }
        return item;
    }));
  };

  const handleAddItem = (orderItemId: string) => {
    const itemToAdd = availableToAddItems.find(i => i.id === orderItemId);
    if (!itemToAdd || itemToAdd.addQuantity <= 0) return;

    const newItem = {
        id: `new-${Date.now()}`,
        orderItemId: itemToAdd.id,
        productId: itemToAdd.productId,
        quantity: itemToAdd.addQuantity,
        unitPrice: itemToAdd.price,
        refundAmount: itemToAdd.addQuantity * itemToAdd.price,
        product: itemToAdd.product,
        maxQuantity: itemToAdd.quantity,
    };

    setItems([...items, newItem]);
    setAvailableToAddItems(availableToAddItems.filter(i => i.id !== orderItemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const finalItems = items.map(item => ({
      id: item.id.startsWith('new-') ? undefined : item.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    const result: ActionResult = await updateReturnOrder(id, { reason, notes, items: finalItems });

    if (result.success) {
      toast.success('تم تحديث المرتجع بنجاح');
      router.push('/admin/returns');
    } else {
      toast.error(result.error || 'فشل تحديث المرتجع');
    }
    setSaving(false);
  };

  // ... (loading / not found JSX) ...

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        {/* ... (Header) ... */}
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                {/* ... (Reason and Notes fields) ... */}

                {/* EDITABLE RETURNED ITEMS */}
                <div className="border-t pt-6">
                    <h3 className="font-bold text-lg mb-3">الأصناف المرتجعة الحالية</h3>
                    <div className="space-y-3">
                        {items.map((item: any) => (
                            <div key={item.id} className="grid grid-cols-12 gap-3 items-center bg-gray-50 p-2 rounded-lg">
                                <div className="col-span-5 font-bold">{item.product.modelNo}</div>
                                <div className="col-span-3">
                                    <input type="number" value={item.quantity} onChange={(e) => handleQuantityChange(item.id, e.target.value)} className="w-full p-2 border rounded-md text-center" min="0" max={item.maxQuantity} />
                                </div>
                                <div className="col-span-3 text-left font-semibold">{(item.quantity * item.unitPrice).toFixed(2)} ج.م</div>
                                <div className="col-span-1 text-left">
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AVAILABLE ITEMS TO ADD */}
                {availableToAddItems.length > 0 && (
                    <div className="border-t pt-6">
                         <h3 className="font-bold text-lg mb-3">إضافة أصناف أخرى للمرتجع (من الأوردر الأصلي)</h3>
                         <div className="space-y-3">
                            {availableToAddItems.map((item: any) => (
                                <div key={item.id} className="grid grid-cols-12 gap-3 items-center bg-blue-50 p-2 rounded-lg">
                                    <div className="col-span-5 font-bold">{item.product.modelNo} <span className="font-normal text-gray-500">(متاح: {item.quantity})</span></div>
                                    <div className="col-span-3">
                                         <input type="number" value={item.addQuantity} onChange={(e) => handleAddQuantityChange(item.id, e.target.value)} className="w-full p-2 border rounded-md text-center" min="0" max={item.quantity} />
                                    </div>
                                    <div className="col-span-4 text-left">
                                        <button type="button" onClick={() => handleAddItem(item.id)} disabled={item.addQuantity <= 0} className="bg-green-500 text-white font-bold py-1 px-3 rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm">+ إضافة</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                 <div className="mt-4 pt-4 border-t-2 border-dashed flex justify-end items-center">
                    <span className="font-bold text-lg">الإجمالي النهائي للمرتجع:</span>
                    <span className="font-bold text-2xl text-red-600 mr-4">{totalRefund.toFixed(2)} ج.م</span>
                </div>

                {/* ... (Action Buttons) ... */}
            </form>
        </div>
    </div>
  );
}
