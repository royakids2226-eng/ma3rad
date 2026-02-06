'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// تعريف نوع البيانات القادمة من السيرفر
type OrderType = {
  id: string;
  orderNo: number;
  customer: { name: string };
  createdAt: Date;
  readinessPercentage: number;
  itemsAllocated: number;
  itemsTotal: number;
};

export default function SortingClient({ initialOrders }: { initialOrders: OrderType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, ready-desc, ready-asc

  // الفلترة والترتيب المباشر (Live)
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...initialOrders];

    // 1. الفلترة (Live Search)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(lowerTerm) ||
          o.orderNo.toString().includes(lowerTerm)
      );
    }

    // 2. الترتيب (Sorting)
    result.sort((a, b) => {
      switch (sortBy) {
        case 'ready-desc': // الأكثر جاهزية أولاً
          return b.readinessPercentage - a.readinessPercentage;
        case 'ready-asc': // الأقل جاهزية أولاً
          return a.readinessPercentage - b.readinessPercentage;
        case 'date-asc': // الأقدم أولاً
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date-desc': // الأحدث أولاً (الافتراضي للعرض)
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [initialOrders, searchTerm, sortBy]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">📦 فرز الأوردرات</h1>
          <p className="text-slate-500 mt-1">توزيع الكميات بأولوية الحجز (FIFO)</p>
        </div>
        
        <div className="flex gap-2">
           <Link 
            href="/" 
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors h-10 flex items-center"
          >
            الرئيسية
          </Link>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row gap-4 border border-slate-100">
        
        {/* Live Search */}
        <div className="flex-1 relative">
            <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
            <input 
                type="text" 
                placeholder="ابحث باسم العميل أو رقم الأوردر..." 
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Sort Select */}
        <div className="w-full md:w-64">
            <select 
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
            >
                <option value="date-desc">التاريخ: الأحدث أولاً</option>
                <option value="date-asc">التاريخ: الأقدم أولاً</option>
                <option value="ready-desc">الجاهزية: الأعلى أولاً</option>
                <option value="ready-asc">الجاهزية: الأقل أولاً</option>
            </select>
        </div>
      </div>

      {/* Grid of Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedOrders.map((order) => {
          let statusColor = "bg-red-500";
          let statusText = "text-red-600";
          let cardBorder = "border-l-4 border-l-red-500";
          let statusLabel = "غير جاهز";

          if (order.readinessPercentage === 100) {
            statusColor = "bg-emerald-500";
            statusText = "text-emerald-600";
            cardBorder = "border-l-4 border-l-emerald-500";
            statusLabel = "جاهز للصرف";
          } else if (order.readinessPercentage > 0) {
            statusColor = "bg-amber-500";
            statusText = "text-amber-600";
            cardBorder = "border-l-4 border-l-amber-500";
            statusLabel = "جاهز جزئياً";
          }

          return (
            <Link key={order.id} href={`/orders/${order.id}/print`}>
              <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 relative overflow-hidden ${cardBorder} cursor-pointer`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{order.customer.name}</h2>
                    <span className="text-sm text-slate-500">#{order.orderNo}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${statusText}`}>
                        {order.readinessPercentage}%
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{statusLabel}</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
                  <div 
                    className={`${statusColor} h-4 rounded-full transition-all duration-500 ease-out`} 
                    style={{ width: `${order.readinessPercentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-sm text-slate-600 mt-2">
                  <span>
                     مطلوب: <span className="font-bold">{order.itemsTotal}</span> / محجوز: <span className={`font-bold ${statusText}`}>{order.itemsAllocated}</span>
                  </span>
                </div>
                
                {order.itemsAllocated < order.itemsTotal && (
                    <div className="mt-2 text-xs text-red-400 bg-red-50 p-2 rounded">
                        ⚠️ الكمية محجوزة لأوردرات أقدم
                    </div>
                )}
                
                <div className="text-xs text-slate-400 mt-2 text-left">
                    {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                </div>

              </div>
            </Link>
          );
        })}

        {filteredAndSortedOrders.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400">
            لا توجد نتائج تطابق بحثك
          </div>
        )}
      </div>
    </div>
  );
}