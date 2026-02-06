import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

interface StockMap {
  [key: string]: number;
}

async function getOrdersWithAllocation() {
  // 1. جلب المخزون
  const warehouseStock = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: { most: true },
  });

  let runningStock: StockMap = {};
  warehouseStock.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      runningStock[item.modelNo] = item._sum.most;
    }
  });

  // 2. جلب الأوردرات
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' }, 
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
    },
  });

  // 3. خوارزمية التوزيع وتفاصيل الأصناف
  const processedOrders = orders.map((order) => {
    let totalItemsRequired = 0;
    let totalItemsAllocated = 0;

    // مصفوفة جديدة نحتفظ فيها بحالة كل صنف
    const itemDetails = order.items.map((item) => {
      const modelNo = item.product.modelNo;
      const qtyNeeded = item.quantity * 4; // تحويل لقطع
      const currentStock = runningStock[modelNo] || 0;
      const qtyAllocated = Math.min(qtyNeeded, currentStock);

      // خصم من الرصيد العام
      if (runningStock[modelNo]) {
        runningStock[modelNo] -= qtyAllocated;
      }

      totalItemsRequired += qtyNeeded;
      totalItemsAllocated += qtyAllocated;

      return {
        id: item.id,
        modelNo: modelNo,
        description: item.product.description || '', // وصف المنتج
        color: item.product.color,
        originalQty: item.quantity, // الكمية بالدستة كما طلبها العميل
        qtyNeededPieces: qtyNeeded,
        qtyAllocatedPieces: qtyAllocated,
        isFullyReady: qtyAllocated >= qtyNeeded, // هل اكتمل؟
        price: item.price
      };
    });

    const percentage = totalItemsRequired > 0 
      ? Math.round((totalItemsAllocated / totalItemsRequired) * 100) 
      : 0;

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
      itemsAllocated: totalItemsAllocated,
      itemsTotal: totalItemsRequired,
      itemDetails: itemDetails // 👈 نمرر التفاصيل للواجهة
    };
  });

  return processedOrders.reverse();
}

export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  const orders = await getOrdersWithAllocation();
  return <SortingClient initialOrders={orders} />;
}