'use client'

import { useState, useEffect } from 'react';
import { getLowStockClosedItems } from '@/app/admin-actions';
import Link from 'next/link';

export default function NotificationsPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // حالة جديدة لتخزين معرفات العناصر التي تم الضغط عليها (شطبها)
    const [readIds, setReadIds] = useState<string[]>([]);

    useEffect(() => {
        getLowStockClosedItems().then(data => {
            setItems(data);
            setLoading(false);
        });
    }, []);

    // دالة التعامل مع الضغط على الكارت
    const handleItemClick = (id: string) => {
        if (!readIds.includes(id)) {
            setReadIds(prev => [...prev, id]);
        }
    };

    // حساب العدد الفعلي (العدد الكلي - عدد المشطوبين)
    const activeCount = items.length - readIds.length;

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
                {/* تم تعديل العداد ليظهر العدد النشط فقط */}
                <div className="text-4xl font-black text-red-600 bg-red-50 px-6 py-2 rounded-2xl border border-red-100 transition-all duration-300">
                    {activeCount}
                </div>
            </div>

            {/* نظهر رسالة الانتهاء فقط إذا تم شطب كل العناصر أو لا توجد عناصر أصلاً */}
            {items.length === 0 || activeCount === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-green-100 transition-all duration-500">
                    <span className="text-6xl mb-4 block">✅</span>
                    <h2 className="text-2xl font-black text-gray-700">المخزون مستقر</h2>
                    <p className="text-gray-400 font-bold mt-2">لا توجد نواقص جديدة (أو تمت مراجعة الكل)</p>
                    <Link href="/admin" className="mt-6 inline-block bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition">
                        عودة للرئيسية
                    </Link>
                    
                    {/* زر لإظهار القائمة مرة أخرى في حال أراد المستخدم مراجعة ما شطبه */}
                    {items.length > 0 && (
                        <button 
                            onClick={() => setReadIds([])}
                            className="block mx-auto mt-4 text-sm text-red-400 hover:text-red-600 underline font-bold"
                        >
                            إظهار العناصر المشطوبة مرة أخرى
                        </button>
                    )}
                </div>
            ) : null}

            {/* الشبكة تظهر دائماً حتى لو العدد صفر، ليختفي العناصر تدريجياً أو تبقى مشطوبة حسب التصميم المفضل، هنا سنخفيها إذا انتهى العداد لإظهار رسالة النجاح، أو يمكنك إزالة الشرط activeCount > 0 لإبقائها مشطوبة */}
            {activeCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => {
                        const isRead = readIds.includes(item.id);
                        
                        // إذا تم شطب العنصر، لا نعرضه لكي تتوافق مع "العداد ينقص"، أو نعرضه مشطوباً.
                        // بناء على طلبك "يتحط عليه خط شطب"، سأقوم بعرضه ولكن بتصميم مختلف.
                        // ملاحظة: قمت بإخفاء القائمة بالكامل في الشرط السابق إذا activeCount وصل لصفر لجمالية الشكل، 
                        // لكن هنا سأتحكم في ظهور كل كارت.
                        
                        return (
                            <div 
                                key={item.id} 
                                onClick={() => handleItemClick(item.id)}
                                className={`
                                    bg-white p-6 rounded-[2rem] border shadow-xl transition-all duration-300 relative overflow-hidden group cursor-pointer select-none
                                    ${isRead 
                                        ? 'border-gray-200 shadow-none opacity-60 grayscale scale-95 bg-gray-50' 
                                        : 'border-red-100 shadow-red-50 hover:shadow-2xl hover:scale-[1.02]'}
                                `}
                            >
                                {/* خط الشطب الأحمر الكبير عند القراءة */}
                                {isRead && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                        <div className="w-[110%] h-1 bg-red-600/40 -rotate-12 transform"></div>
                                    </div>
                                )}

                                <div className={`absolute top-0 left-0 w-2 h-full ${isRead ? 'bg-gray-400' : 'bg-red-500'}`}></div>
                                
                                <div className={`flex justify-between items-start mb-4 ${isRead ? 'line-through decoration-slate-400' : ''}`}>
                                    <div>
                                        <h3 className="font-black text-xl text-gray-800">موديل: {item.modelNo}</h3>
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold mt-2 inline-block ${isRead ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600'}`}>
                                            اللون: {item.color}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-xs font-black uppercase tracking-widest mb-1 ${isRead ? 'text-gray-400' : 'text-red-400'}`}>الرصيد</div>
                                        <div className={`text-3xl font-black ${isRead ? 'text-gray-500' : 'text-red-600'}`}>{item.currentStock}</div>
                                    </div>
                                </div>
                                
                                <div className={`border-t border-gray-100 pt-4 mt-2 flex justify-between items-center text-sm ${isRead ? 'line-through text-gray-400' : ''}`}>
                                    <span className="font-bold text-gray-400">سعر القطعة:</span>
                                    <span className="font-black text-gray-800 font-mono">{item.price} ج.م</span>
                                </div>

                                <div className="mt-4 flex gap-2 relative z-30">
                                    <Link 
                                        href={`/admin/products?search=${item.modelNo}`} 
                                        className={`flex-1 py-3 rounded-xl font-bold text-center transition-colors 
                                            ${isRead 
                                                ? 'bg-gray-200 text-gray-400 pointer-events-none' 
                                                : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                                        onClick={(e) => {
                                           // لمنع تفعيل الشطب مرتين إذا ضغط على الزر، أو السماح به. 
                                           // هنا نسمح به ليتم الشطب عند الضغط على الزر أيضاً
                                        }}
                                    >
                                        {isRead ? 'تمت المراجعة' : 'إدارة الصنف'}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}