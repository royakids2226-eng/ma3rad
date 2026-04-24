'use client'

import { useState, useEffect } from 'react';
import {
    syncWarehouseFromSheets,
    getWarehouseSyncHistory,
    revertWarehouseSync
} from '@/app/warehouse-actions';

interface SyncControlProps {
    onSyncComplete: () => void;
}

export default function WarehouseSyncControl({ onSyncComplete }: SyncControlProps) {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1); // تاريخ افتراضي: قبل شهر من الآن
        return d.toISOString().split('T')[0];
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [isReverting, setIsReverting] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const historyData = await getWarehouseSyncHistory();
        setHistory(historyData);
    };

    const handleSync = async () => {
        if (!confirm(`سيتم سحب بيانات المستودع من جوجل شيت منذ يوم ${startDate}، هل أنت متأكد؟`)) return;
        
        setIsSyncing(true);
        try {
            const result = await syncWarehouseFromSheets(startDate);
            if (result.success) {
                alert(result.message);
                loadHistory();
                onSyncComplete(); // تحديث البيانات في الصفحة الرئيسية
            } else {
                alert("فشل المزامنة: " + result.error);
            }
        } catch (e: any) {
            alert("حدث خطأ فادح: " + e.message);
        }
        setIsSyncing(false);
    };

    const handleRevert = async (op: any) => {
        if (!confirm(`تحذير: سيتم التراجع عن هذه العملية التي أضافت ${op.itemsCount} إيصال.\nسيتم حذف الإيصالات من قاعدة البيانات.\nهل أنت متأكد؟`)) return;
        
        setIsReverting(op.id);
        try {
            const res = await revertWarehouseSync(op.id);
            if (res.success) {
                alert("تم التراجع بنجاح.");
                loadHistory();
                onSyncComplete(); // تحديث البيانات
            } else {
                alert("خطأ في التراجع: " + res.error);
            }
        } catch (e: any) {
            alert("حدث خطأ فادح أثناء التراجع: " + e.message);
        }
        setIsReverting(null);
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex flex-col gap-4" dir="rtl">
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-500 mr-1">بدء المزامنة من تاريخ:</label>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                    />
                </div>

                <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`mt-5 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                    {isSyncing ? (
                        <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> جاري السحب...</>
                    ) : (
                        <><span>🔄 مزامنة إيصالات المستودع</span></>
                    )}
                </button>
            </div>

            {/* عرض سجل عمليات المزامنة */}
            {history.length > 0 && (
                <div className="w-full">
                    <h4 className="text-xs font-bold text-gray-500 mb-2">أحدث عمليات مزامنة المستودع:</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600">
                                    <th className="p-2 border">وقت العملية</th>
                                    <th className="p-2 border">تاريخ الاستهداف</th>
                                    <th className="p-2 border">عدد الإيصالات</th>
                                    <th className="p-2 border text-center">إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((op) => (
                                    <tr key={op.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 border font-mono text-[10px]" dir="ltr">
                                            {new Date(op.createdAt).toLocaleString('en-GB')}
                                        </td>
                                        <td className="p-2 border font-bold text-blue-600">
                                            {new Date(op.startDate).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="p-2 border font-bold text-green-600">
                                            {op.itemsCount} إيصال
                                        </td>
                                        <td className="p-2 border text-center">
                                            <button 
                                                onClick={() => handleRevert(op)}
                                                disabled={isReverting === op.id}
                                                className="bg-red-50 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-100 disabled:opacity-50"
                                            >
                                                {isReverting === op.id ? 'جاري الإلغاء...' : '↩️ تراجع'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
