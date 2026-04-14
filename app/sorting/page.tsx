import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

async function getOrdersWithAllocation() {
  // 1. Fetch product list to determine color distribution for each model
  const productsList = await prisma.product.findMany({
    select: { modelNo: true, color: true },
  });

  const modelColorCount: { [key: string]: number } = {};
  productsList.forEach((p) => {
    if (p.modelNo) {
      modelColorCount[p.modelNo] = (modelColorCount[p.modelNo] || 0) + 1;
    }
  });

  // 2. Fetch total incoming stock (pieces) for each model
  const warehouseIn = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: { most: true },
  });

  // 3. Fetch total fulfilled stock (pieces) for each color
  const fulfilledItems = await prisma.orderItem.findMany({
    where: { fulfilledQty: { gt: 0 } },
    include: { product: true },
  });

  // 4. Build the available stock map with fair distribution for each color
  const availableStockByColor: { [model: string]: { [color: string]: number } } = {};

  warehouseIn.forEach((item) => {
    const model = item.modelNo;
    if (!model) return;

    const totalPieces = item._sum.most || 0;
    const colorCount = modelColorCount[model] || 1;
    const piecesPerColor = Math.floor(totalPieces / colorCount);

    if (!availableStockByColor[model]) {
      availableStockByColor[model] = {};
    }

    productsList
      .filter((p) => p.modelNo === model && p.color)
      .forEach((p) => {
        if (p.color) availableStockByColor[model][p.color] = piecesPerColor;
      });
  });

  fulfilledItems.forEach((item) => {
    const model = item.product.modelNo;
    const color = item.product.color;
    if (availableStockByColor[model] && availableStockByColor[model][color] !== undefined) {
      availableStockByColor[model][color] -= item.fulfilledQty;
    }
  });

  // 5. Fetch all orders with required details
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      customer: {
        include: {
          payments: {
            where: { type: { in: ['IN', 'PAYMENT_COLLECTION'] } },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
      items: {
        include: { product: true, logs: true },
      },
    },
  });

  // 6. Final calculations for orders and financial data
  const processedOrders = orders.map((order) => {
    let totalItemsPending = 0;
    let totalItemsAllocated = 0;
    let isCompletelyDone = true;

    let depositsList = order.customer.payments.map((p) => p.amount);
    if (depositsList.length === 0 && order.deposit > 0) {
      depositsList = [order.deposit];
    }
    const historicalDepositString = depositsList.length > 0 ? depositsList.join(' + ') : '0';

    const itemDetails = order.items.map((item) => {
      const modelNo = item.product.modelNo;
      const color = item.product.color;
      const isItemPostponed = (item as any).isPostponed || false;

      const totalQtyPieces = item.quantity * 4;
      const alreadyFulfilled = item.fulfilledQty;
      const remainingNeeded = Math.max(0, totalQtyPieces - alreadyFulfilled);

      if (remainingNeeded > 0) {
        isCompletelyDone = false;
      }

      let qtyAllocatedNow = 0;

      // New Logic: If the item is postponed, do not reserve stock for it
      if (!isItemPostponed && remainingNeeded > 0) {
        const currentStockForThisColor =
          (availableStockByColor[modelNo] && availableStockByColor[modelNo][color]) || 0;
        qtyAllocatedNow = Math.min(remainingNeeded, Math.max(0, currentStockForThisColor));

        if (availableStockByColor[modelNo] && availableStockByColor[modelNo][color] !== undefined) {
          availableStockByColor[modelNo][color] -= qtyAllocatedNow;
        }
      }

      totalItemsPending += remainingNeeded;
      totalItemsAllocated += qtyAllocatedNow;

      return {
        id: item.id,
        orderItemId: item.id,
        modelNo,
        color,
        description: item.product.description || '',
        qtyAllocatedPieces: qtyAllocatedNow,
        isPostponed: isItemPostponed, // Send status to the UI
        remainingNeeded,
        alreadyFulfilled,
        originalQtyDozens: item.quantity,
        totalQtyPieces,
        price: item.price,
        isFullyReady: qtyAllocatedNow >= remainingNeeded && remainingNeeded > 0 && !isItemPostponed,
        logs: item.logs.map((log) => ({
          batchId: log.batchId,
          quantity: log.quantity,
          createdAt: log.createdAt,
        })),
      };
    });

    return {
      id: order.id,
      orderNo: order.orderNo,
      createdAt: order.createdAt,
      orderSpecificDeposit: Number(order.deposit) || 0,
      orderTotalAmount: Number(order.totalAmount) || 0,
      orderRemainingBalance: (Number(order.totalAmount) || 0) - (Number(order.deposit) || 0),
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        phone2: (order.customer as any).phone2 || null,
        address: order.customer.address,
        historicalDepositsText: historicalDepositString,
      },
      readinessPercentage:
        totalItemsPending > 0
          ? Math.round((totalItemsAllocated / totalItemsPending) * 100)
          : isCompletelyDone
          ? 100
          : 0,
      itemsAllocatedNow: totalItemsAllocated,
      itemsPendingTotal: totalItemsPending,
      isCompletelyDone,
      totalFulfilledOverall: itemDetails.reduce((acc, item) => acc + item.alreadyFulfilled, 0),
      itemDetails,
    };
  });

  return processedOrders.reverse();
}

/**
 * The main React Component for the sorting page.
 */
export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();
  return <SortingClient initialOrders={orders} />;
}

export const dynamic = 'force-dynamic';