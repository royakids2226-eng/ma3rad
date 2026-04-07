'use client'
import { useState, useEffect } from 'react';
import { getPayments, updatePayment, deletePayment } from '@/app/admin-actions';
import { getSafes, getCustomers } from '@/app/actions';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import { BanknotesIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';

const typeStyles: { [key: string]: { badge: string; text: string; icon: React.ElementType } } = {
    INCOME: { badge: "bg-green-100 text-green-800", text: "قبض", icon: ArrowDownTrayIcon },
    EXPENSE: { badge: "bg-red-100 text-red-800", text: "صرف", icon: ArrowUpTrayIcon },
    TRANSFER: { badge: "bg-blue-100 text-blue-800", text: "تحويل", icon: ArrowPathRoundedSquareIcon },
};

export default function CashManagementPage() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPayment, setEditingPayment] = useState<any>(null);
    const [safes, setSafes] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
        getSafes().then(setSafes);
        getCustomers().then(setCustomers);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const res = await getPayments();
        if (res.success) {
            setPayments(res.data);
        }
        setLoading(false);
    };

    const handleEdit = (payment: any) => {
        setEditingPayment({ ...payment });
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد أنك تريد حذف هذه الحركة؟')) {
            await deletePayment(id);
            fetchData();
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPayment) return;
        await updatePayment(editingPayment.id, {
            amount: editingPayment.amount,
            description: editingPayment.description,
            type: editingPayment.type,
            currency: editingPayment.currency,
            safeId: editingPayment.safeId,
            targetSafeId: editingPayment.targetSafeId,
            customerId: editingPayment.customerId,
        });
        setEditingPayment(null);
        fetchData();
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><p>جاري التحميل...</p></div>;
    }

    return (
        <div dir="rtl" className="bg-white p-4 md:p-8 rounded-2xl shadow-xl animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b border-gray-100 pb-6 mb-6">
                 <h1 className="text-2xl md:text-3xl font-black text-gray-800">إدارة النقدية</h1>
                 <BanknotesIcon className="w-10 h-10 text-gray-300"/>
            </div>

            {/* Mobile & Tablet View (Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
                {payments.map(p => {
                    const TypeIcon = typeStyles[p.type]?.icon || BanknotesIcon;
                    return (
                        <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-lg transition-shadow duration-300">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="font-bold text-lg text-gray-800">{p.description}</p>
                                    <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${typeStyles[p.type]?.badge}`}>
                                        {typeStyles[p.type]?.text}
                                    </p>
                                </div>
                                <p className="font-black text-xl text-gray-800">{p.amount.toLocaleString()} <span className="text-sm text-gray-400">{p.currency}</span></p>
                            </div>
                            <div className="text-sm text-gray-500 space-y-2 pt-3 border-t border-gray-50">
                                <p><strong>الخزنة:</strong> {p.safe?.name} {p.type === 'TRANSFER' && p.targetSafe ? `-> ${p.targetSafe.name}` : ''}</p>
                                {p.customer && <p><strong>العميل:</strong> {p.customer.name}</p>}
                                <p><strong>الموظف:</strong> {p.user?.name}</p>
                                <p><strong>التاريخ:</strong> {new Date(p.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric'})}</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-50">
                                <button onClick={() => handleEdit(p)} className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"><PencilIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDelete(p.id)} className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-right">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الوصف</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الخزنة</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">العميل</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الموظف</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeStyles[p.type]?.badge}`}>{typeStyles[p.type]?.text}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">{p.description}</td>
                                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{p.amount.toLocaleString()} <span className="text-xs text-gray-400">{p.currency}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.safe?.name} {p.type === 'TRANSFER' && p.targetSafe ? `-> ${p.targetSafe.name}` : ''}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.customer?.name || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.user?.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString('ar-EG')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-3">
                                     <button onClick={() => handleEdit(p)} className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"><PencilIcon className="w-5 h-5"/></button>
                                     <button onClick={() => handleDelete(p.id)} className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Edit Modal */}
            {editingPayment && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-in fade-in duration-300">
                     <div className="bg-white p-8 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl m-4">
                         <h2 className="text-2xl font-bold mb-6 text-gray-800">تعديل الحركة</h2>
                         <form onSubmit={handleUpdate} dir="rtl">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                 <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                                     <input type="number" value={editingPayment.amount} onChange={(e) => setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3"/>
                                 </div>
                                 <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
                                     <select value={editingPayment.type} onChange={(e) => setEditingPayment({ ...editingPayment, type: e.target.value })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3">
                                         <option value="INCOME">قبض</option>
                                         <option value="EXPENSE">صرف</option>
                                         <option value="TRANSFER">تحويل</option>
                                     </select>
                                 </div>
                             </div>
                             <div className="mb-4">
                                 <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                                 <textarea value={editingPayment.description} onChange={(e) => setEditingPayment({ ...editingPayment, description: e.target.value })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3" rows={3}></textarea>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">الخزنة</label>
                                     <select value={editingPayment.safeId || ''} onChange={(e) => setEditingPayment({ ...editingPayment, safeId: e.target.value })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3">
                                         <option value="">اختر الخزنة</option>
                                         {safes.map(safe => <option key={safe.id} value={safe.id}>{safe.name}</option>)}
                                     </select>
                                 </div>
                                 {editingPayment.type === 'TRANSFER' && (
                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">الخزنة المستهدفة</label>
                                         <select value={editingPayment.targetSafeId || ''} onChange={(e) => setEditingPayment({ ...editingPayment, targetSafeId: e.target.value })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3">
                                             <option value="">اختر الخزنة المستهدفة</option>
                                             {safes.map(safe => <option key={safe.id} value={safe.id}>{safe.name}</option>)}
                                         </select>
                                     </div>
                                 )}
                                 <div>
                                     <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
                                     <select value={editingPayment.customerId || ''} onChange={(e) => setEditingPayment({ ...editingPayment, customerId: e.target.value })} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3">
                                         <option value="">اختر العميل</option>
                                         {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                                     </select>
                                 </div>
                             </div>
                             <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                                 <button type="button" onClick={() => setEditingPayment(null)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-all">إلغاء</button>
                                 <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20">تحديث الحركة</button>
                             </div>
                         </form>
                     </div>
                 </div>
            )}
        </div>
    );
}
