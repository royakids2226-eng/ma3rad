'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto'; // لإنشاء معرف فريد للباتش

type FulfillmentItem = {
  orderItemId: string;
  qtyToFulfill: number;
};

export async function executeOrderBatch(orderId: string, items: FulfillmentItem[]) {
  try {
    // إنشاء معرف موحد لهذه الدفعة (Batch ID)
    const batchId = randomUUID();

    await prisma.$transaction(
      items.map((item) => {
        // عمليتان لكل صنف:
        // 1. تحديث إجمالي المنفذ في OrderItem
        // 2. إنشاء سجل جديد في FulfillmentLog
        return [
            prisma.orderItem.update({
                where: { id: item.orderItemId },
                data: {
                    fulfilledQty: {
                        increment: item.qtyToFulfill,
                    },
                },
            }),
            prisma.fulfillmentLog.create({
                data: {
                    orderItemId: item.orderItemId,
                    quantity: item.qtyToFulfill,
                    batchId: batchId,
                }
            })
        ];
      }).flat() // دمج المصفوفات لأننا نرجع مصفوفتين لكل عنصر
    );

    revalidatePath('/sorting');
    
    return { success: true };
  } catch (error) {
    console.error('Error executing batch:', error);
    return { success: false, error: 'Failed to update order items' };
  }
}

export async function undoOrderBatch(batchId: string) {
  if (!batchId) {
    return { success: false, error: 'Batch ID is required' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. جلب كل سجلات الصرف للباتش المحدد
      const logs = await tx.fulfillmentLog.findMany({
        where: { batchId: batchId },
      });

      if (logs.length === 0) {
        throw new Error('No logs found for this batch ID.');
      }

      // 2. تجميع التحديثات المطلوبة لـ OrderItem
      const updates = new Map<string, number>();
      for (const log of logs) {
        updates.set(log.orderItemId, (updates.get(log.orderItemId) || 0) + log.quantity);
      }

      // 3. تنفيذ التحديثات (طرح الكميات)
      for (const [orderItemId, quantity] of updates.entries()) {
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            fulfilledQty: {
              decrement: quantity,
            },
          },
        });
      }

      // 4. حذف سجلات الصرف لهذا الباتش
      await tx.fulfillmentLog.deleteMany({
        where: { batchId: batchId },
      });
    });

    revalidatePath('/sorting');
    return { success: true };

  } catch (error) {
    console.error('Error undoing batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to undo batch';
    return { success: false, error: errorMessage };
  }
}
