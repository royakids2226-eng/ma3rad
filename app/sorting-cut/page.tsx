// app/sorting-cut/page.tsx
import { PrismaClient } from '@prisma/client';
import SortingCutClient from './SortingCutClient';

const prisma = new PrismaClient();

async function getOrdersWithColorStockAllocation() {
  try {
    const allProducts = await prisma.product.findMany({
      include: { orderItems: { select: { fulfilledQty: true } } }
    });

    let availableByProductId: { [id: string]: number } = {};
    allProducts.forEach(p => {
      const totalFulfilled = p.orderItems.reduce((sum, item) => sum + item.fulfilledQty, 0);
      availableByProductId[p.id] = (p.stockQty || 0) - totalFulfilled;
    });

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        customer: {
          include: { payments: { where: { type: { in: ['IN', 'PAYMENT_COLLECTION'] } }, orderBy: { createdAt: 'asc' } } }
        },
        items: { include: { product: true, logs: true } }
      }
    });

    const processedOrders = orders.map((order) => {
      let totalItemsPending = 0;
      let totalItemsAllocated = 0;
      let isCompletelyDone = true;

      const itemDetails = order.items.map((item) => {
        const isItemPostponed = item.isPostponed || false;
        const totalQtyPieces = item.quantity * 4;
        const alreadyFulfilled = item.fulfilledQty;
        const remainingNeeded = Math.max(0, totalQtyPieces - alreadyFulfilled);
        if (remainingNeeded > 0) isCompletelyDone = false;
        let qtyAllocatedNow = 0;
        if (!isItemPostponed && remainingNeeded > 0) {
          const availableStock = availableByProductId[item.productId] || 0;
          qtyAllocatedNow = Math.min(remainingNeeded, Math.max(0, availableStock));
          availableByProductId[item.productId] -= qtyAllocatedNow;
        }
        totalItemsPending += remainingNeeded;
        totalItemsAllocated += qtyAllocatedNow;

        return {
          id: item.id, orderItemId: item.id, modelNo: item.product.modelNo, vendor: item.product.vendor, color: item.product.color,
          qtyAllocatedPieces: qtyAllocatedNow, isPostponed: isItemPostponed, remainingNeeded,
          alreadyFulfilled, totalQtyPieces, price: item.price,
          isFullyReady: Boolean(qtyAllocatedNow >= remainingNeeded && remainingNeeded > 0 && !isItemPostponed),
          logs: item.logs.map(log => ({ batchId: log.batchId, quantity: log.quantity, createdAt: log.createdAt }))
        };
      });

      const depositsList = order.customer.payments.map(p => p.amount);
      if (depositsList.length === 0 && order.deposit > 0) depositsList.push(order.deposit);

      return {
        id: order.id, orderNo: order.orderNo, createdAt: order.createdAt,
        orderSpecificDeposit: Number(order.deposit) || 0,
        orderTotalAmount: Number(order.totalAmount) || 0,
        orderRemainingBalance: Number(order.totalAmount || 0) - Number(order.deposit || 0),
        customer: {
          name: order.customer.name, phone: order.customer.phone,
          phone2: (order.customer as any).phone2 || null,
          address: order.customer.address, historicalDepositsText: depositsList.join(' + ') || '0'
        },
        readinessPercentage: totalItemsPending > 0 ? Math.round((totalItemsAllocated / totalItemsPending) * 100) : (isCompletelyDone ? 100 : 0),
        itemsAllocatedNow: totalItemsAllocated, itemsPendingTotal: totalItemsPending,
        isCompletelyDone, totalFulfilledOverall: itemDetails.reduce((acc, i) => acc + i.alreadyFulfilled, 0),
        itemDetails
      };
    });

    return JSON.parse(JSON.stringify(processedOrders.reverse()));
  } catch (error) {
    console.error("Fetch Error:", error);
    return [];
  }
}

export default async function SortingCutPage() {
  const orders = await getOrdersWithColorStockAllocation();
  return <SortingCutClient initialOrders={orders} />;
}
export const dynamic = 'force-dynamic';
