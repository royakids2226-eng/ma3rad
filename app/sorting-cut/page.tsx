import { prisma } from '@/lib/prisma';
import SortingCutClient from './SortingCutClient';

async function getOrdersWithMaterialAllocation() {
  // 1. حساب الرصيد الفعلي لكل منتج (ID المنتج هو المفتاح)
  const allProducts = await prisma.product.findMany({
    include: {
      orderItems: {
        where: { fulfilledQty: { gt: 0 } },
        select: { fulfilledQty: true }
      }
    }
  });

  let actualStockMap: { [productId: string]: number } = {};
  allProducts.forEach(p => {
    const totalFulfilled = p.orderItems.reduce((sum, item) => sum + item.fulfilledQty, 0);
    // الرصيد المتاح = الأولي من جدول Product - ما صُرف فعلياً
    actualStockMap[p.id] = (p.stockQty || 0) - totalFulfilled;
  });

  // 2. جلب الأوردرات ومعالجتها
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      customer: {
        include: {
          payments: { where: { type: { in: ['IN', 'PAYMENT_COLLECTION'] } }, orderBy: { createdAt: 'asc' } }
        }
      },
      items: { include: { product: true, logs: true } }
    }
  });

  const processedOrders = orders.map((order) => {
    let totalItemsPending = 0;
    let totalItemsAllocated = 0;
    let isCompletelyDone = true;

    const itemDetails = order.items.map((item) => {
      const isItemPostponed = (item as any).isPostponed || false;
      const totalQtyPieces = item.quantity * 4;
      const alreadyFulfilled = item.fulfilledQty;
      const remainingNeeded = Math.max(0, totalQtyPieces - alreadyFulfilled);

      if (remainingNeeded > 0) isCompletelyDone = false;

      let qtyAllocatedNow = 0;
      // التوزيع الدقيق بناءً على ID المنتج (الخامة واللون)
      if (!isItemPostponed && remainingNeeded > 0) {
        const available = actualStockMap[item.productId] || 0;
        qtyAllocatedNow = Math.min(remainingNeeded, Math.max(0, available));
        actualStockMap[item.productId] -= qtyAllocatedNow;
      }

      totalItemsPending += remainingNeeded;
      totalItemsAllocated += qtyAllocatedNow;

      return {
        id: item.id,
        orderItemId: item.id,
        modelNo: item.product.modelNo,
        material: item.product.material, // سيقبله الآن لأنه أصبح null-safe في الواجهة
        color: item.product.color,
        qtyAllocatedPieces: qtyAllocatedNow,
        // التعديل هنا: نضمن أنها قيمة Boolean حقيقية
        isPostponed: Boolean(isItemPostponed), 
        remainingNeeded,
        alreadyFulfilled,
        totalQtyPieces,
        price: item.price,
        isFullyReady: Boolean(qtyAllocatedNow >= remainingNeeded && remainingNeeded > 0 && !isItemPostponed),
        logs: item.logs.map(log => ({ batchId: log.batchId, quantity: log.quantity, createdAt: log.createdAt }))
    };
    });

    // معالجة العرابين (نفس منطق الفرز العام)
    let depositsList = order.customer.payments.map(p => p.amount);
    if (depositsList.length === 0 && order.deposit > 0) depositsList = [order.deposit];

    return {
      id: order.id,
      orderNo: order.orderNo,
      createdAt: order.createdAt,
      orderSpecificDeposit: Number(order.deposit) || 0,
      orderTotalAmount: Number(order.totalAmount) || 0,
      orderRemainingBalance: Number(order.totalAmount || 0) - Number(order.deposit || 0),
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        phone2: (order.customer as any).phone2 || null,
        address: order.customer.address,
        historicalDepositsText: depositsList.join(' + ') || '0'
      },
      readinessPercentage: totalItemsPending > 0 ? Math.round((totalItemsAllocated / totalItemsPending) * 100) : (isCompletelyDone ? 100 : 0),
      itemsAllocatedNow: totalItemsAllocated,
      itemsPendingTotal: totalItemsPending,
      isCompletelyDone,
      totalFulfilledOverall: itemDetails.reduce((acc, i) => acc + i.alreadyFulfilled, 0),
      itemDetails
    };
  });

  return processedOrders.reverse();
}

export default async function SortingCutPage() {
  const orders = await getOrdersWithMaterialAllocation();
  return <SortingCutClient initialOrders={orders} />;
}
export const dynamic = 'force-dynamic';
