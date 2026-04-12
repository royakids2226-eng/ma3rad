import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

interface StockMap {
  [key: string]: number;
}

async function getOrdersWithAllocation() {
  // 1. جلب إجمالي الوارد
  const warehouseIn = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: { most: true },
  });

  // 2. جلب إجمالي المنصرف
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

  Object.keys(availableStock).forEach(key => {
    if (availableStock[key] < 0) availableStock[key] = 0;
  });


  // 3. جلب الأوردرات مع تفاصيل العميل ومدفوعاته
const orders = await prisma.order.findMany({
  orderBy: { createdAt: 'asc' }, 
  include: {
    customer: {
        include: {
            // جلب كل المدفوعات من نوع "IN" (توريد) أو "PAYMENT_COLLECTION"
            payments: {
                where: {
                    type: { in: ['IN', 'PAYMENT_COLLECTION'] }
                },
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

  // 4. الحسابات
  const processedOrders = orders.map((order) => {
    // تجهيز نص العرابين: نجمع مبالغ المدفوعات ونفصل بينهم بـ +
    const depositsList = order.customer.payments.map(p => p.amount);
    const depositString = depositsList.length > 0 ? depositsList.join(' + ') : 'بدون عربون';


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

        isFullyReady: qtyAllocatedNow >= remainingNeeded && remainingNeeded > 0,
        price: item.price,

        // 👈 نمرر السجلات للعميل
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
      customer: { 
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
        depositsText: depositString
      },
      createdAt: order.createdAt,
      readinessPercentage: percentage,
      itemsAllocatedNow: totalItemsAllocated,
      itemsPendingTotal: totalItemsPending,
      isCompletelyDone: isCompletelyDone,
      itemDetails: itemDetails
    };
  });

  // نعيد ترتيب المصفوفة ليكون الأحدث أولاً، ولا نقوم بإخفاء المنتهية هنا
  // سنترك الفلترة للعميل (Client Component)
  return processedOrders.reverse();
}

export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();
  return <SortingClient initialOrders={orders} />;
}