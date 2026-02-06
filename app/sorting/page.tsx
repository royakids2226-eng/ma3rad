import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// تعريف نوع البيانات للمخزون
interface StockMap {
  [key: string]: number;
}

async function getOrdersWithAllocation() {
  // 1. جلب رصيد المخزن الفعلي وتجميعه
  const warehouseStock = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: {
      most: true,
    },
  });

  // تحويل المخزون إلى كائن (Object) لسهولة التعامل والتعديل عليه (الخصم)
  // StockMap = { "3700": 40, "4000": 100 }
  let runningStock: StockMap = {};
  warehouseStock.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      runningStock[item.modelNo] = item._sum.most;
    }
  });

  // 2. جلب الأوردرات (يجب ترتيبها من الأقدم للأحدث لضمان أولوية الحجز)
  // ASC = الأقدم أولاً (هو الذي يأخذ البضاعة)
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' }, 
    where: {
        // يمكنك هنا فلترة الأوردرات المفتوحة فقط لزيادة السرعة مستقبلاً
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // 3. خوارزمية التوزيع (FIFO Allocation)
  const processedOrders = orders.map((order) => {
    let totalItemsRequired = 0;
    let totalItemsAllocated = 0;

    // نمر على كل صنف في الأوردر
    order.items.forEach((item) => {
      const modelNo = item.product.modelNo;
      
      // الكمية المطلوبة (بالقطعة) = الكمية * 4
      const qtyNeeded = item.quantity * 4;
      
      // البحث عن الرصيد المتبقي لهذا الموديل في "اللحظة الحالية"
      const currentStock = runningStock[modelNo] || 0;

      // تحديد الكمية التي سنحجزها لهذا الأوردر (إما كل المطلوب أو ما تبقى في المخزن)
      const qtyAllocated = Math.min(qtyNeeded, currentStock);

      // ⚠️ خطوة جوهرية: خصم الكمية المحجوزة من الرصيد العام
      // حتى لا يراها الأوردر التالي
      if (runningStock[modelNo]) {
        runningStock[modelNo] -= qtyAllocated;
      }

      totalItemsRequired += qtyNeeded;
      totalItemsAllocated += qtyAllocated;
    });

    // حساب النسبة
    const percentage = totalItemsRequired > 0 
      ? Math.round((totalItemsAllocated / totalItemsRequired) * 100) 
      : 0;

    return {
      ...order,
      readinessPercentage: percentage,
      itemsAllocated: totalItemsAllocated,
      itemsTotal: totalItemsRequired
    };
  });

  // 4. إعادة ترتيب المصفوفة للعرض (اختياري: الأحدث في الأعلى للعرض، أو الجاهز في الأعلى)
  // سنقوم بعكسها ليكون الأحدث في الأعلى، لكن بعد أن تم حساب النسب بناءً على الأقدمية
  return processedOrders.reverse();
}

export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();

  return (
    <div className="p-6 bg-slate-50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">📦 فرز الأوردرات (توزيع ذكي)</h1>
          <p className="text-slate-500 mt-1">يتم حجز الكميات للأوردرات الأقدم أولاً (FIFO)</p>
        </div>
        <Link 
          href="/" 
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          رجوع للرئيسية
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => {
          // Logic للألوان
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
                
                {/* شرح حالة الحجز */}
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

        {orders.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400">
            لا توجد أوردرات
          </div>
        )}
      </div>
    </div>
  );
}