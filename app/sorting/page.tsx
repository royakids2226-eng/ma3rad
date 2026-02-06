import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

interface StockMap {
  [key: string]: number;
}

async function getOrdersWithAllocation() {
  // 1. جلب إجمالي الوارد (المخزن)
  const warehouseIn = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: { most: true },
  });

  // 2. جلب إجمالي المنصرف (ما تم تنفيذه في أوردرات سابقة)
  // نحتاج تجميع fulfilledQty لكل منتج من جدول OrderItem
  // بما أن OrderItem مربوط بـ Product وليس modelNo مباشرة، سنجلب البيانات ونجمعها يدوياً أو عبر groupBy إذا كان prisma يدعم ذلك عبر العلاقة (Prisma groupBy limited on relations).
  // الحل الأضمن: جلب كل OrderItem الذي له fulfilledQty > 0
  const fulfilledItems = await prisma.orderItem.findMany({
    where: { fulfilledQty: { gt: 0 } },
    include: { product: true },
  });

  // حساب الرصيد الفعلي المتاح (الوارد - المنصرف)
  let availableStock: StockMap = {};

  // أضف الوارد
  warehouseIn.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      availableStock[item.modelNo] = item._sum.most;
    }
  });

  // اخصم المنصرف
  fulfilledItems.forEach((item) => {
    const model = item.product.modelNo;
    if (availableStock[model]) {
      availableStock[model] -= item.fulfilledQty;
    }
  });

  // تنظيف الأرصدة السالبة (تحوطاً)
  Object.keys(availableStock).forEach(key => {
    if (availableStock[key] < 0) availableStock[key] = 0;
  });


  // 3. جلب الأوردرات التي لم تكتمل بعد
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' }, // FIFO
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
    },
  });

  // 4. خوارزمية التوزيع وتفاصيل الأصناف
  const processedOrders = orders.map((order) => {
    let totalItemsPending = 0;   // إجمالي القطع المتبقية للتنفيذ في هذا الأوردر
    let totalItemsAllocated = 0; // إجمالي القطع التي يمكن توفيرها الآن (الباتش الحالي)

    // هل الأوردر مكتمل بالكامل سابقاً؟ (لا يوجد أي صنف له رصيد متبقي)
    let isCompletelyDone = true;

    const itemDetails = order.items.map((item) => {
      const modelNo = item.product.modelNo;
      
      // الحسابات
      const totalQtyPieces = item.quantity * 4; // المطلوب الكلي (قطعة)
      const alreadyFulfilled = item.fulfilledQty; // ما تم تنفيذه سابقاً (قطعة)
      const remainingNeeded = Math.max(0, totalQtyPieces - alreadyFulfilled); // المتبقي (قطعة)

      if (remainingNeeded > 0) isCompletelyDone = false;

      // حساب المتاح للتنفيذ الآن من الرصيد الحر
      const currentStock = availableStock[modelNo] || 0;
      const qtyAllocatedNow = Math.min(remainingNeeded, currentStock);

      // خصم ما تم حجزه لهذا الأوردر من الرصيد العام المؤقت
      if (availableStock[modelNo]) {
        availableStock[modelNo] -= qtyAllocatedNow;
      }

      totalItemsPending += remainingNeeded;
      totalItemsAllocated += qtyAllocatedNow;

      return {
        id: item.id,
        orderItemId: item.id,
        modelNo: modelNo,
        description: item.product.description || '',
        color: item.product.color,
        
        originalQtyDozens: item.quantity,
        totalQtyPieces: totalQtyPieces,
        
        alreadyFulfilled: alreadyFulfilled, // تم تنفيذه سابقاً
        remainingNeeded: remainingNeeded,   // ما يحتاجه الآن
        qtyAllocatedPieces: qtyAllocatedNow,// ما سأنفذه في هذا الباتش

        isFullyReady: qtyAllocatedNow >= remainingNeeded && remainingNeeded > 0, // هل هذا الباتش يغلق الصنف؟
        price: item.price
      };
    });

    // حساب النسبة المئوية بناءً على (المتوفر الآن / المتبقي)
    // إذا لم يتبق شيء (0)، فالنسبة 100% (أو يتم تجاهله لاحقاً)
    const percentage = totalItemsPending > 0 
      ? Math.round((totalItemsAllocated / totalItemsPending) * 100) 
      : (isCompletelyDone ? 100 : 0);

    return {
      id: order.id,
      orderNo: order.orderNo,
      customer: { 
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address 
      },
      createdAt: order.createdAt,
      readinessPercentage: percentage,
      
      // بيانات للعرض
      itemsAllocatedNow: totalItemsAllocated, // قطع جاهزة للصرف الآن
      itemsPendingTotal: totalItemsPending,   // قطع مطلوبة لإغلاق الأوردر
      isCompletelyDone: isCompletelyDone,     // هل الأوردر منتهي تماماً؟
      
      itemDetails: itemDetails
    };
  });

  // تصفية الأوردرات المنتهية تماماً (اختياري، لكن يفضل إخفاؤها أو وضعها في قسم آخر)
  // هنا سنعرض فقط الأوردرات التي بها متبقي > 0
  const activeOrders = processedOrders.filter(o => !o.isCompletelyDone).reverse();

  return activeOrders;
}

export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();
  return <SortingClient initialOrders={orders} />;
}