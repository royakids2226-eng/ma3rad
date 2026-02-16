'use client'

import { useState, useEffect } from 'react';
import { getLowStockClosedItems } from '@/app/admin-actions'; 
import { markNotificationAsRead, resetNotifications } from './actions'; // استدعاء الأكشن الجديد
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // جلب البيانات عند فتح الصفحة
    // ملاحظة: تأكد أن getLowStockClosedItems في admin-actions تجلب حقل isStockAlertRead
    // أو سيتم الاعتماد على التحديث المباشر هنا
    useEffect(() => {
        const fetchData = async () => {
            // سنقوم بجلب البيانات هنا للتأكد من حصولنا على أحدث حالة
            // يمكنك استبدال هذا بالدالة الخاصة بك إذا قمت بتحديثها لتشمل isStockAlertRead
            try {
                const res = await getLowStockClosedItems(); 
                setItems(res);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // دالة التعامل مع الضغط
    const handleItemClick = async (id: string, isAlreadyRead: boolean) => {
        if (isAlreadyRead) return; // لو مشطوب بالفعل لا تفعل شيئاً

        // 1. تحديث متفائل (Optimistic Update) ليظهر الشطب فوراً للمستخدم
        setItems(prevItems => 
            prevItems.map(item => 
                item.id === id ? { ...item, isStockAlertRead: true } : item
            )
        );

        // 2. تحديث قاعدة البيانات في الخلفية
        await markNotificationAsRead(id);
        
        // 3. تحديث الراوتر لتحديث أي مكونات أخرى معتمدة على البيانات (مثل الجرس)
        router.refresh();
    };

    // إعادة تعيين القائمة
    const handleReset = async () => {
        setLoading(true);
        await resetNotifications();
        const res = await getLowStockClosedItems();
        setItems(res);
        setLoading(false);
        router.refresh();
    };

    // ترتيب العناصر: غير المقروء أولاً، ثم المقروء (المشطوب)
    // ملاحظة: نفترض أن البيانات القادمة تحتوي على isStockAlertRead. 
    // إذا لم تكن تحتوي عليه، يجب تعديل getLowStockClosedItems في ملف admin-actions.ts
    const sortedItems = [...items].sort((a, b) => {
        // نعتبر undefined كأنه false (غير مقروء)
        const readA = a.isStockAlertRead || false;
        const readB = b.isStockAlertRead || false;
        
        if (readA === readB) return 0;
        return readA ? 1 : -1; // المقروء ينزل تحت
    });

    // حساب العداد الفعلي (غير المشطوب فقط)
    const activeCount = items.filter(i => !i.isStockAlertRead).length;

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[50vh] gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="font-bold text-gray-400">جاري تحميل التنبيهات والمزامنة...</div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* الهيدر والعداد */}
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-red-100 sticky top-4 z-40 transition-all">
                <div className="flex items-center gap-4">
                    <div className="bg-red-100 text-red-600 p-3 rounded-xl">
                        <span className="text-3xl">🔔</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">إشعارات نواقص المخزون</h1>
                        <p className="text-gray-500 font-bold text-sm mt-1">
                            أصناف (مغلقة) وصلت للحد الأدنى | تتم المزامنة تلقائياً
                        </p>
                    </div>
                </div>
                {/* العداد النشط */}
                <div className={`text-4xl font-black px-6 py-2 rounded-2xl border transition-all duration-300 ${activeCount === 0 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {activeCount}
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
                    {sortedItems.map((item) => {
                        const isRead = item.isStockAlertRead || false;
                        
                        return (
                            <div 
                                key={item.id} 
                                onClick={() => handleItemClick(item.id, isRead)}
                                className={`
                                    relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden group select-none
                                    ${isRead 
                                        ? 'bg-gray-100 border-gray-200 grayscale opacity-60 scale-95 cursor-default order-last' // ستايل المشطوب
                                        : 'bg-white border-red-100 shadow-xl shadow-red-50 hover:shadow-2xl hover:scale-[1.02] cursor-pointer order-first' // ستايل الجديد
                                    }
                                `}
                            >
                                {/* ================== خط الشطب الأحمر المائل ================== */}
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
                                            // السماح بالانتشار ليتم الشطب عند الضغط على الزر أيضاً
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

            {/* زر لإعادة التعيين (اختياري) يظهر فقط إذا كان هناك عناصر مشطوبة */}
            {items.some(i => i.isStockAlertRead) && (
                <div className="text-center mt-12">
                    <button 
                        onClick={handleReset}
                        className="text-red-400 hover:text-red-600 underline font-bold text-sm bg-red-50 px-6 py-2 rounded-xl transition hover:bg-red-100"
                    >
                        إعادة تعيين الكل كـ "جديد"
                    </button>
                </div>
            )}
        </div>
    );
}