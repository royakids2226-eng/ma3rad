'use client'
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

// Represents the structure of an allocated item
type AllocatedItem = {
  orderItemId: string;
  modelNo: string;
  color: string;
  material?: string | null; // إضافة الخامة
  qtyAllocatedPieces: number;
  isPostponed: boolean;
  // أضف هذه الحقول الثلاثة لحل خطأ الـ Build
  orderId: string;
  orderNo: number;
  customerName: string;
};

// Structure for the final dispatch note
interface DispatchNote {
    orderId: string;
    orderNo: number;
    customerName: string;
    items: { model: string; color: string; qty: number; material: string; }[];
}

export default function SortingCutClient({ initialOrders }: { initialOrders: any[] }) {
    const [orders, setOrders] = useState(initialOrders);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedItems, setSelectedItems] = useState<AllocatedItem[]>([]);
    const [dispatchNotes, setDispatchNotes] = useState<DispatchNote[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const filteredOrders = useMemo(() => {
        if (activeTab === 'pending') return orders.filter(o => !o.isCompletelyDone);
        if (activeTab === 'done') return orders.filter(o => o.isCompletelyDone);
        return orders;
    }, [orders, activeTab]);

    const handleSelectItem = (orderId: string, orderNo: number, customerName: string, item: any) => {
        setSelectedItems(prev => {
            const isAlreadySelected = prev.some(i => i.orderItemId === item.orderItemId);

            if (isAlreadySelected) {
                return prev.filter(i => i.orderItemId !== item.orderItemId);
            } else {
                const newItem: AllocatedItem = {
                    orderItemId: item.orderItemId,
                    modelNo: item.modelNo,
                    color: item.color,
                    material: item.material,
                    qtyAllocatedPieces: item.qtyAllocatedPieces,
                    isPostponed: item.isPostponed,
                    orderId: orderId,
                    orderNo: orderNo,
                    customerName: customerName
                };
                return [...prev, newItem];
            }
        });
    };

    const handleGenerateDispatchNotes = () => {
        const notes: { [orderId: string]: DispatchNote } = {};
        selectedItems.forEach((item: any) => {
            if (!notes[item.orderId]) {
                notes[item.orderId] = {
                    orderId: item.orderId,
                    orderNo: item.orderNo,
                    customerName: item.customerName,
                    items: [],
                };
            }
            notes[item.orderId].items.push({
                model: item.modelNo,
                color: item.color,
                qty: item.qtyAllocatedPieces,
                material: item.material,
            });
        });
        setDispatchNotes(Object.values(notes));
        setActiveTab('dispatch');
    };

    const handleConfirmDispatch = async () => {
        if(!confirm("هل تريد تأكيد صرف الكميات المحددة؟ هذه العملية ستخصم من المخزون ولا يمكن التراجع عنها.")) return;
        
        setIsProcessing(true);
        try {
            const res = await fetch('/api/dispatch', { 
                method: 'POST', 
                body: JSON.stringify({ items: selectedItems }),
                headers: { 'Content-Type': 'application/json' }
            });

            if(!res.ok) throw new Error('فشل في تحديث قاعدة البيانات');
            
            alert('تم تحديث المخزون بنجاح!');
            window.location.reload(); // Reload to get fresh data

        } catch (error: any) {
            alert('خطأ: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen" dir="rtl">
            <div className="bg-white p-4 rounded-2xl shadow-lg border-r-8 border-indigo-600 mb-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl md:text-3xl font-black text-indigo-800">✂️ فرز بالقص (دقيق بالألوان)</h1>
                    <Link href="/" className="text-sm text-indigo-600 font-bold">العودة للرئيسية</Link>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-bold">نظام توزيع دقيق يعتمد على رصيد كل "لون وخامة" على حدة.</p>
            </div>

            <div className="flex border-b mb-4">
                <button onClick={() => setActiveTab('pending')} className={`py-2 px-4 font-bold ${activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}>طلبات قيد الانتظار ({orders.filter(o => !o.isCompletelyDone).length})</button>
                <button onClick={() => setActiveTab('done')} className={`py-2 px-4 font-bold ${activeTab === 'done' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}>طلبات مكتملة ({orders.filter(o => o.isCompletelyDone).length})</button>
                {selectedItems.length > 0 && <button onClick={handleGenerateDispatchNotes} className={`py-2 px-4 font-black text-white bg-indigo-600 rounded-t-lg ml-auto animate-pulse`}>معاينة إذن الصرف ({selectedItems.length})</button>}
            </div>

            {activeTab === 'dispatch' ? (
                // Dispatch Notes View
                <div className="bg-white p-6 rounded-2xl shadow-xl">
                    <h2 className="font-extrabold text-2xl mb-4 text-center">إذن صرف مجمع</h2>
                    {dispatchNotes.map(note => (
                        <div key={note.orderId} className="mb-6 p-4 border rounded-lg print-section">
                            <div className="flex justify-between items-center border-b pb-2 mb-2">
                                <div>
                                    <h3 className="font-bold">اوردر رقم: {note.orderNo}</h3>
                                    <p className="text-sm text-gray-600">العميل: {note.customerName}</p>
                                </div>
                                <button onClick={() => window.print()} className="text-indigo-600 no-print">طباعة</button>
                            </div>
                            <table className="w-full text-sm">
                                <thead><tr className="bg-gray-100"><th className="p-2">موديل</th><th className="p-2">لون</th><th className="p-2">خام</th><th className="p-2">الكمية</th></tr></thead>
                                <tbody>
                                    {note.items.map(item => <tr key={`${item.model}-${item.color}`}><td className="p-2 border-b">{item.model}</td><td className="p-2 border-b">{item.color}</td><td className="p-2 border-b text-xs">{item.material}</td><td className="p-2 border-b font-bold">{item.qty} قطعة</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <div className="text-center mt-6 no-print">
                        <button onClick={handleConfirmDispatch} disabled={isProcessing} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-400">
                            {isProcessing ? '...جاري التأكيد' : 'تأكيد الصرف النهائي وتحديث المخزون'}
                        </button>
                        <button onClick={() => setActiveTab('pending')} className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg ml-4">العودة</button>
                    </div>
                </div>
            ) : (
                // Orders View
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredOrders.map(order => (
                        <div key={order.id} className="bg-white rounded-2xl shadow-md overflow-hidden transition-all hover:shadow-xl">
                            <div className={`p-4 border-b-8 ${order.isCompletelyDone ? 'border-green-400' : `border-yellow-400`}`}>
                                <div className="flex justify-between items-center">
                                    <h2 className="font-extrabold text-lg text-gray-800">اوردر #{order.orderNo}</h2>
                                    <span className="text-xs text-gray-500 font-mono">{new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="font-bold text-indigo-700">{order.customer.name}</p>
                                <p className="text-xs text-gray-600">{order.customer.address} - {order.customer.phone}</p>
                                
                                <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
                                    <p>اجمالي الاوردر: <span className="font-bold">{order.orderTotalAmount} ج</span></p>
                                    <p>عربون: <span className="font-bold text-green-600">{order.orderSpecificDeposit} ج</span></p>
                                    <p>رصيد سابق للعميل: <span className="font-bold text-blue-600">{order.customer.historicalDepositsText} ج</span></p>
                                </div>
                            </div>

                            <div className="p-4">
                                {order.itemDetails.map((item: any) => {
                                    const isSelected = selectedItems.some(i => i.orderItemId === item.id);
                                    const isReady = item.qtyAllocatedPieces > 0;
                                    return (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg mb-2 transition-all ${isSelected ? 'bg-indigo-100' : 'bg-gray-50'}`}>
                                            <div className="flex items-center">
                                                <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 rounded disabled:opacity-50" 
                                                       checked={isSelected} 
                                                       onChange={() => handleSelectItem(order.id, order.orderNo, order.customer.name, item)} 
                                                       disabled={!isReady} />
                                                <div className="mr-3">
                                                    <p className="font-bold text-gray-900">{item.modelNo} - <span className="text-indigo-700">{item.color}</span></p>
                                                    <p className="text-[10px] text-gray-500 font-mono">الخام: {item.material}</p>
                                                    <p className={`text-xs font-bold ${item.isPostponed ? 'text-red-500' : 'text-gray-600'}`}>{item.isPostponed ? '(مؤجل)' : `مطلوب: ${item.totalQtyPieces} ق`}</p>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-black text-lg ${isReady ? 'text-green-600' : 'text-red-500'}`}>{item.qtyAllocatedPieces} ق</p>
                                                <p className="text-[10px] text-gray-500">جاهز للصرف</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                             <div className="bg-gray-100 p-2 text-center text-xs font-bold">
                                جاهزية الاوردر: {order.readinessPercentage}%
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
