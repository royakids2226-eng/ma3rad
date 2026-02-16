'use client';

import { useState } from 'react';
import Link from 'next/link';

// تعريف نوع البيانات كما تأتي من قاعدة البيانات
type ProductType = {
  id: string;
  modelNo: string;
  color: string;
  currentStock: number;
  price: number;
};

export default function NotificationClient({ initialProducts }: { initialProducts: ProductType[] }) {
  // حالة لتخزين مصفوفة المنتجات
  const [products, setProducts] = useState(initialProducts);
  
  // حالة لتخزين معرفات المنتجات التي تم "شطبها"
  const [readIds, setReadIds] = useState<string[]>([]);

  // حساب العدد الحالي (العدد الكلي - عدد المشطوبين)
  const currentCount = products.length - readIds.length;

  // دالة التعامل مع الضغط على الكارت
  const handleCardClick = (id: string) => {
    if (readIds.includes(id)) return; // إذا كان مشطوباً بالفعل لا تفعل شيئاً
    setReadIds((prev) => [...prev, id]);
  };

  return (
    <div className="p-4 space-y-6" dir="rtl">
      {/* ============ الهيدر والعداد ============ */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-red-100 text-red-600 font-bold text-3xl px-6 py-3 rounded-xl min-w-[80px] text-center shadow-inner">
            {currentCount}
          </div>
        </div>

        <div className="text-left">
          <div className="flex items-center gap-2 justify-end mb-1">
            <h1 className="text-2xl font-bold text-slate-800">إشعارات نواقص المخزون</h1>
            <span className="text-3xl">🔔</span>
          </div>
          <p className="text-slate-500 font-medium">أصناف (مغلقة) وصلت للحد الأدنى (4 قطع أو أقل)</p>
        </div>
      </div>

      {/* ============ شبكة البطاقات ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const isRead = readIds.includes(product.id);

          return (
            <div
              key={product.id}
              onClick={() => handleCardClick(product.id)}
              className={`
                relative bg-white rounded-2xl p-5 shadow-sm border border-slate-100 
                transition-all duration-300 cursor-pointer select-none
                ${isRead ? 'opacity-50 grayscale bg-gray-50' : 'hover:shadow-md hover:-translate-y-1'}
              `}
            >
              {/* تأثير خط الشطب */}
              {isRead && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="w-[90%] h-[2px] bg-red-500/50 rotate-[-12deg]"></div>
                </div>
              )}

              <div className={`flex justify-between items-start mb-4 ${isRead ? 'line-through decoration-red-400' : ''}`}>
                {/* الجزء الأيسر: الرصيد */}
                <div className="text-center">
                  <p className="text-slate-400 text-xs font-bold mb-1">الرصيد</p>
                  <p className="text-3xl font-black text-red-600">{product.currentStock}</p>
                </div>

                {/* الجزء الأيمن: بيانات الموديل */}
                <div className="text-left">
                  <h3 className="text-2xl font-black text-slate-800 mb-1">
                    موديل: <span className="font-sans">{product.modelNo}</span>
                  </h3>
                  <div className="flex justify-end">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold">
                      اللون: {product.color}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`flex justify-between items-end mt-4 pt-4 border-t border-slate-50 ${isRead ? 'line-through decoration-slate-400' : ''}`}>
                <p className="text-lg font-bold text-slate-700">
                  {product.price} <span className="text-xs text-slate-400">ج.م</span>
                </p>
                <p className="text-xs text-slate-400 font-bold">سعر القطعة:</p>
              </div>

              {/* زر إدارة الصنف - نستخدم stopPropagation لمنع تفعيل الشطب عند الضغط على الزر تحديداً إذا أردت */}
              <div className="mt-4">
                <Link
                  href={`/admin/products?search=${product.modelNo}`}
                  className={`
                    block w-full py-3 rounded-xl text-center font-bold transition-colors z-30 relative
                    ${isRead 
                      ? 'bg-gray-200 text-gray-400 cursor-default' 
                      : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'}
                  `}
                  onClick={(e) => {
                     // إذا أردت أن يذهب لصفحة المنتج دون شطب الإشعار، ألغِ التعليق التالي:
                     // e.stopPropagation(); 
                  }}
                >
                  إدارة الصنف
                </Link>
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400">
            <span className="text-4xl block mb-2">✅</span>
            <p>لا توجد نواقص حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}