'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

type FulfillmentItem = {
  orderItemId: string;
  qtyToFulfill: number; // الكمية التي سيتم صرفها الآن (بالقطعة)
};

export async function executeOrderBatch(orderId: string, items: FulfillmentItem[]) {
  try {
    // نستخدم transaction لضمان سلامة البيانات
    await prisma.$transaction(
      items.map((item) => {
        return prisma.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            // نقوم بزيادة الكمية المنفذة بالقيمة الجديدة
            fulfilledQty: {
              increment: item.qtyToFulfill,
            },
          },
        });
      })
    );

    // إعادة تحميل صفحة الفرز لتحديث البيانات والحسابات
    revalidatePath('/sorting');
    
    return { success: true };
  } catch (error) {
    console.error('Error executing batch:', error);
    return { success: false, error: 'Failed to update order items' };
  }
}