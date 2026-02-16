'use client'

import { useState } from 'react';
import Link from 'next/link';
import { markNotificationAsRead, resetNotifications } from './actions';
import { useRouter } from 'next/navigation';

type ItemType = {
    id: string;
    modelNo: string;
    color: string;
    currentStock: number;
    price: number;
    isStockAlertRead: boolean;
};

export default function NotificationListClient({ initialItems }: { initialItems: ItemType[] }) {
    const router = useRouter();
    const [optimisticReadIds, setOptimisticReadIds] = useState<string[]>([]);
    
    // حساب العناصر المقروءة (سواء من الداتا بيز أو اللي لسه دايس عليها حالا)
    const isItemRead = (item: ItemType) => item.isStockAlertRead || optimisticReadIds.includes(item.id);

    // ترتيب العناصر: غير المقروء فوق
    const sortedItems = [...initialItems].sort((a, b) => {
        const readA = isItemRead(a);
        const readB = isItemRead(b);
        if (readA === readB) return a.currentStock - b.currentStock;
        return readA ? 1 : -1;
    });

    // عدد العناصر النشطة (غير المشطوبة)
    const activeCount = initialItems.filter(item => !isItemRead(item)).length;

    const handleItemClick = async (id: string) => {
        // تحديث شكلي فوري
        if (!optimisticReadIds.includes(id)) {
            setOptimisticReadIds(prev => [...prev, id]);
            
            // تحديث قاعدة البيانات
            await markNotificationAsRead(id);
            
            // تحديث الصفحة لجلب البيانات الجديدة
            router.refresh();
        }
    };

    const handleReset = async () => {
        await resetNotifications();
        setOptimisticReadIds([]);
        router.refresh();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 mt-6">
            {/* الهيدر */}
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-red-100 sticky top-4 z-40">
                <div className="flex items-center gap-4">
                    <div className="bg-red-100 text-red-600 p-3 rounded-xl">
                        <span className="text-3xl">🔔</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">إشعارات نواقص المخزون</h1>
                        <p className="text-gray-500 font-bold text-sm mt-1">
                            تتم المزامنة بين جميع الأجهزة
                        </p>
                    </div>
                </div>
                <div className={`text-4xl font-black px-6 py-2 rounded-2xl border transition-all duration-300 ${activeCount === 0 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {activeCount}
                </div>
            </div>

            {sortedItems.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-green-100">
                    <span className="text-6xl mb-4 block">✅</span>
                    <h2 className="text-2xl font-black text-gray-700">المخزون مستقر</h2>
                    <p className="text-gray-400 font-bold mt-2">لا توجد نواقص حالياً</p>
                    <Link href="/admin" className="mt-6 inline-block bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition">
                        عودة للرئيسية
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedItems.map((item) => {
                        const isRead = isItemRead(item);

                        return (
                            <div 
                                key={item.id} 
                                onClick={() => !isRead && handleItemClick(item.id)}
                                className={`
                                    relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden group select-none
                                    ${isRead 
                                        ? 'bg-gray-100 border-gray-200 grayscale opacity-60 scale-95 cursor-default' 
                                        : 'bg-white border-red-100 shadow-xl shadow-red-50 hover:shadow-2xl hover:scale-[1.02] cursor-pointer'}
                                `}
                            >
                                {/* خط الشطب */}
                                {isRead && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                        <div className="w-[120%] h-1.5 bg-red-600/70 -rotate-12 shadow-sm"></div>
                                    </div>
                                )}

                                <div className={`absolute top-0 left-0 w-2 h-full transition-colors ${isRead ? 'bg-gray-400' : 'bg-red-500'}`}></div>
                                
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div>
                                        <h3 className={`font-black text-xl transition-all ${isRead ? 'text-gray-500 line-through decoration-2' : 'text-gray-800'}`}>
                                            موديل: {item.modelNo}
                                        </h3>
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold mt-2 inline-block ${isRead ? 'bg-gray-200 text-gray-400 line-through' : 'bg-gray-100 text-gray-600'}`}>
                                            اللون: {item.color}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-xs font-black uppercase tracking-widest mb-1 ${isRead ? 'text-gray-400' : 'text-red-400'}`}>الرصيد</div>
                                        <div className={`text-3xl font-black transition-all ${isRead ? 'text-gray-400 line-through' : 'text-red-600'}`}>
                                            {item.currentStock}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={`border-t border-gray-100 pt-4 mt-2 flex justify-between items-center text-sm relative z-10 ${isRead ? 'opacity-50' : ''}`}>
                                    <span className={`font-bold ${isRead ? 'text-gray-400 line-through' : 'text-gray-400'}`}>سعر القطعة:</span>
                                    <span className={`font-black font-mono ${isRead ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.price} ج.م</span>
                                </div>

                                <div className="mt-4 relative z-20">
                                    {isRead ? (
                                        <div className="w-full py-3 rounded-xl font-bold text-center bg-gray-200 text-gray-400 cursor-default">
                                            تمت المراجعة
                                        </div>
                                    ) : (
                                        <Link 
                                            href={`/admin/products?search=${item.modelNo}`} 
                                            // هنا لا نوقف الانتشار لكي يسمح بالشطب عند الضغط على الزر أيضاً
                                            className="block w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold text-center hover:bg-red-600 hover:text-white transition-colors"
                                        >
                                            إدارة الصنف
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* زر إعادة التعيين */}
            {initialItems.some(i => i.isStockAlertRead) && (
                <div className="text-center mt-12">
                    <button 
                        onClick={handleReset}
                        className="text-red-400 hover:text-red-600 underline font-bold text-sm bg-red-50 px-6 py-2 rounded-xl transition"
                    >
                        إعادة تعيين الكل كـ (غير مقروء)
                    </button>
                </div>
            )}
        </div>
    );
}