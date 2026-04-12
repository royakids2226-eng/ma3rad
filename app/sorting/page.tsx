import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

interface StockMap {
  [key: string]: number;
}

async function getOrdersWithAllocation() {
  // 1. جلب إجمالي الوارد من المخزن
  const warehouseIn = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: { most: true },
  });

  // 2. جلب إجمالي المنصرف (الذي خرج فعلياً)
  const fulfilledItems = await prisma.orderItem.findMany({
    where: { fulfilledQty: { gt: 0 } },
    include: { product: true },
  });

  let availableStock: StockMap = {};
  warehouseIn.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      availableStock[item.modelNo] = item._sum.most;
    }
  });

  fulfilledItems.forEach((item) => {
    const model = item.product.modelNo;
    if (availableStock[model]) {
      availableStock[model] -= item.fulfilledQty;
    }
  });

  // 3. جلب الأوردرات مع تفاصيل العميل ومدفوعاته التاريخية
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' }, 
    include: {
      customer: {
        include: {
          payments: {
            where: { type: { in: ['IN', 'PAYMENT_COLLECTION'] } },
            orderBy: { createdAt: 'asc' }
          }
        }
      },
      items: {
        include: { 
            product: true,
            logs: true
        },
      },
    },
  });

  // 4. الحسابات النهائية للأوردرات
  const processedOrders = orders.map((order) => {
    // 1. جلب قائمة المدفوعات المسجلة للعميل
    let depositsList = order.customer.payments.map(p => p.amount);
    
    // 2. --- الحل الذكي ---
    // إذا كانت قائمة المدفوعات فارغة للعميل، ولكن الأوردر نفسه يحتوي على مبلغ عربون مسجل
    // سنقوم بإضافة مبلغ عربون الأوردر للقائمة ليظهر خارجياً
    if (depositsList.length === 0 && order.deposit > 0) {
        depositsList = [order.deposit];
    }

    // تجهيز النص للكارت الخارجي (مثلاً: 500 + 500 أو المبلغ الوحيد المتاح)
    const historicalDepositString = depositsList.length > 0 ? depositsList.join(' + ') : '0';

    let totalItemsPending = 0;
    let totalItemsAllocated = 0;
    let isCompletelyDone = true;

    const itemDetails = order.items.map((item) => {
      const modelNo = item.product.modelNo;
      const totalQtyPieces = item.quantity * 4; 
      const alreadyFulfilled = item.fulfilledQty; 
      const remainingNeeded = Math.max(0, totalQtyPieces - alreadyFulfilled); 

      if (remainingNeeded > 0) isCompletelyDone = false;

      const currentStock = availableStock[modelNo] || 0;
      const qtyAllocatedNow = Math.min(remainingNeeded, currentStock);

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
        alreadyFulfilled: alreadyFulfilled,
        remainingNeeded: remainingNeeded,
        qtyAllocatedPieces: qtyAllocatedNow,
        price: item.price, // سعر القطعة
        logs: item.logs.map(log => ({
            batchId: log.batchId,
            quantity: log.quantity,
            createdAt: log.createdAt
        }))
      };
    });

    const percentage = totalItemsPending > 0 
      ? Math.round((totalItemsAllocated / totalItemsPending) * 100) 
      : (isCompletelyDone ? 100 : 0);

    return {
      id: order.id,
      orderNo: order.orderNo,
      createdAt: order.createdAt,
      
      // الحقول المالية الصريحة للفاتورة (تستخدم داخل إذن الصرف)
      orderSpecificDeposit: Number(order.deposit) || 0, 
      orderTotalAmount: Number(order.totalAmount) || 0,
      orderRemainingBalance: (Number(order.totalAmount) || 0) - (Number(order.deposit) || 0),

      customer: { 
        name: order.customer.name,
        phone: order.customer.phone,
        phone2: (order.customer as any).phone2 || null,
        address: order.customer.address,
        // النص الذي سيظهر الآن بشكل مضمون على الكارت من الخارج
        historicalDepositsText: historicalDepositString 
      },

      readinessPercentage: percentage,
      itemsAllocatedNow: totalItemsAllocated,
      itemsPendingTotal: totalItemsPending,
      isCompletelyDone: isCompletelyDone,
      itemDetails: itemDetails
    };
  });

  return processedOrders.reverse();
}

export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();
  return <SortingClient initialOrders={orders} />;
}
