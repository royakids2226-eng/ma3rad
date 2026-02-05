import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// دالة لجلب البيانات وحساب النسب (تعمل على السيرفر)
async function getOrdersWithReadiness() {
  // 1. جلب رصيد المخزن الفعلي (تجميع كميات most لكل موديل)
  const warehouseStock = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: {
      most: true,
    },
  });

  // تحويل المخزون إلى Map لسهولة البحث بسرعة عالية
  // الشكل: { "MODEL-001": 50, "MODEL-002": 20 }
  const stockMap = new Map<string, number>();
  warehouseStock.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      stockMap.set(item.modelNo, item._sum.most);
    }
  });

  // 2. جلب الأوردرات المفتوحة (أو الكل حسب الحاجة) مع تفاصيل الأصناف والعملاء
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' }, // الأحدث أولاً
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // 3. حساب نسبة الجاهزية لكل أوردر
  const ordersWithStatus = orders.map((order) => {
    let totalItemsRequired = 0;
    let totalItemsAvailableInStock = 0;

    order.items.forEach((item) => {
      const modelNo = item.product.modelNo;
      const requiredQty = item.quantity;
      
      // الكمية الموجودة فعلياً في المخزن لهذا الموديل
      // (نستخدم القيمة المحفوظة في الذاكرة لتجنب استعلامات كثيرة)
      const actualStockQty = stockMap.get(modelNo) || 0;

      // الكمية المتوفرة لهذا البند تحديداً
      // (لا يمكن أن تزيد عن الكمية المطلوبة في الأوردر)
      // ملاحظة: هذا حساب نظري (هل البضاعة موجودة بالمخزن؟) ولا يخصم المحجوز لأوردرات أخرى
      const readyQty = Math.min(requiredQty, actualStockQty);

      totalItemsRequired += requiredQty;
      totalItemsAvailableInStock += readyQty;
    });

    // حساب النسبة المئوية
    const percentage = totalItemsRequired > 0 
      ? Math.round((totalItemsAvailableInStock / totalItemsRequired) * 100) 
      : 0;

    return {
      ...order,
      readinessPercentage: percentage,
      itemsFound: totalItemsAvailableInStock,
      itemsTotal: totalItemsRequired
    };
  });

  return ordersWithStatus;
}

export const dynamic = 'force-dynamic'; // لضمان عدم تخزين الصفحة (Cache) وتحديث البيانات دائماً

export default async function SortingPage() {
  const orders = await getOrdersWithReadiness();

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">📦 فرز ومتابعة الأوردرات</h1>
          <p className="text-slate-500 mt-1">مقارنة الأوردرات برصيد المخزن الفعلي (القص)</p>
        </div>
        <Link 
          href="/" 
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          رجوع للرئيسية
        </Link>
      </div>

      {/* Grid of Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => {
          // تحديد لون الحالة بناءً على النسبة
          let statusColor = "bg-red-500";
          let statusText = "text-red-600";
          let cardBorder = "border-l-4 border-l-red-500";

          if (order.readinessPercentage === 100) {
            statusColor = "bg-emerald-500";
            statusText = "text-emerald-600";
            cardBorder = "border-l-4 border-l-emerald-500";
          } else if (order.readinessPercentage >= 50) {
            statusColor = "bg-amber-500";
            statusText = "text-amber-600";
            cardBorder = "border-l-4 border-l-amber-500";
          }

          return (
            <Link key={order.id} href={`/orders/${order.id}/print`}>
              <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 relative overflow-hidden ${cardBorder} cursor-pointer`}>
                
                {/* Order Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{order.customer.name}</h2>
                    <span className="text-sm text-slate-500">أوردر رقم: #{order.orderNo}</span>
                  </div>
                  <div className={`text-xl font-bold ${statusText}`}>
                    {order.readinessPercentage}%
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
                  <div 
                    className={`${statusColor} h-4 rounded-full transition-all duration-500 ease-out`} 
                    style={{ width: `${order.readinessPercentage}%` }}
                  ></div>
                </div>

                {/* Details Footer */}
                <div className="flex justify-between items-center text-sm text-slate-600 mt-2">
                  <span>
                    الكمية: {order.itemsTotal} / <span className="font-bold">المتاح: {order.itemsFound}</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>

              </div>
            </Link>
          );
        })}

        {orders.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400">
            لا توجد أوردرات حالياً
          </div>
        )}
      </div>
    </div>
  );
}