'use client'

import { useState, useEffect } from 'react';
import { getLowStockClosedItems } from '@/app/admin-actions';
import Link from 'next/link';

export default function NotificationsPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLowStockClosedItems().then(data => {
            setItems(data);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[50vh] gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="font-bold text-gray-400">جاري تحميل التنبيهات...</div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                <div className="flex items-center gap-4">
                    <div className="bg-red-100 text-red-600 p-3 rounded-xl">
                        <span className="text-3xl">🔔</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">إشعارات نواقص المخزون</h1>
                        <p className="text-gray-500 font-bold text-sm mt-1">
                            أصناف (مغلقة) وصلت للحد الأدنى (4 قطع أو أقل)
                        </p>
                    </div>
                </div>
                <div className="text-4xl font-black text-red-600 bg-red-50 px-6 py-2 rounded-2xl border border-red-100">
                    {items.length}
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-green-100">
                    <span className="text-6xl mb-4 block">✅</span>
                    <h2 className="text-2xl font-black text-gray-700">المخزون مستقر</h2>
                    <p className="text-gray-400 font-bold mt-2">لا توجد أصناف مغلقة وصلت للحد الأدنى</p>
                    <Link href="/admin" className="mt-6 inline-block bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition">
                        عودة للرئيسية
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-red-100 shadow-xl shadow-red-50 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-black text-xl text-gray-800">موديل: {item.modelNo}</h3>
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold mt-2 inline-block">
                                        اللون: {item.color}
                                    </span>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">الرصيد</div>
                                    <div className="text-3xl font-black text-red-600">{item.currentStock}</div>
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-100 pt-4 mt-2 flex justify-between items-center text-sm">
                                <span className="font-bold text-gray-400">سعر القطعة:</span>
                                <span className="font-black text-gray-800 font-mono">{item.price} ج.م</span>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <Link 
                                    href={`/admin/products?search=${item.modelNo}`} 
                                    className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-center hover:bg-red-600 hover:text-white transition-colors"
                                >
                                    إدارة الصنف
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}