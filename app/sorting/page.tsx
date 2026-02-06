import { prisma } from '@/lib/prisma';
import SortingClient from './SortingClient';

// تعريف نوع البيانات للمخزون
interface StockMap {
  [key: string]: number;
}

// دالة لجلب البيانات وتوزيع الحصص (Server-Side Logic)
async function getOrdersWithAllocation() {
  // 1. جلب رصيد المخزن الفعلي وتجميعه
  const warehouseStock = await prisma.warehouseReceipt.groupBy({
    by: ['modelNo'],
    _sum: {
      most: true,
    },
  });

  // تحويل المخزون إلى كائن (Running Stock) للخصم منه
  let runningStock: StockMap = {};
  warehouseStock.forEach((item) => {
    if (item.modelNo && item._sum.most) {
      runningStock[item.modelNo] = item._sum.most;
    }
  });

  // 2. جلب الأوردرات مرتبة من الأقدم للأحدث (FIFO Allocation)
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' }, 
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // 3. خوارزمية التوزيع (تخصيص الكميات)
  const processedOrders = orders.map((order) => {
    let totalItemsRequired = 0;
    let totalItemsAllocated = 0;

    order.items.forEach((item) => {
      const modelNo = item.product.modelNo;
      
      // تحويل الكمية لقطع (ضرب × 4)
      const qtyNeeded = item.quantity * 4;
      
      // الرصيد الحالي المتاح في هذه اللحظة
      const currentStock = runningStock[modelNo] || 0;

      // حجز الكمية (الأقل من المطلوب أو المتاح)
      const qtyAllocated = Math.min(qtyNeeded, currentStock);

      // خصم المحجوز من الرصيد العام (حتى لا يأخذه الأوردر التالي)
      if (runningStock[modelNo]) {
        runningStock[modelNo] -= qtyAllocated;
      }

      totalItemsRequired += qtyNeeded;
      totalItemsAllocated += qtyAllocated;
    });

    // حساب النسبة المئوية
    const percentage = totalItemsRequired > 0 
      ? Math.round((totalItemsAllocated / totalItemsRequired) * 100) 
      : 0;

    // إرجاع كائن بيانات مبسط للمكون التفاعلي
    return {
      id: order.id,
      orderNo: order.orderNo,
      customer: { name: order.customer.name },
      createdAt: order.createdAt,
      readinessPercentage: percentage,
      itemsAllocated: totalItemsAllocated,
      itemsTotal: totalItemsRequired
    };
  });

  // نعيد المصفوفة معكوسة (الأحدث في البداية) كترتيب افتراضي للعرض
  return processedOrders.reverse();
}

// لضمان عدم تخزين الصفحة وتحديث البيانات عند كل طلب
export const dynamic = 'force-dynamic';

export default async function SortingPage() {
  // تنفيذ منطق الحساب على السيرفر
  const orders = await getOrdersWithAllocation();

  // تمرير البيانات الجاهزة للمكون التفاعلي (Client Component)
  return <SortingClient initialOrders={orders} />;
}