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
    const batchId = randomUUID();

    await prisma.$transaction(async (tx) => {
      // 1. Create all fulfillment logs in a single batch operation
      await tx.fulfillmentLog.createMany({
        data: items.map(item => ({
          orderItemId: item.orderItemId,
          quantity: item.qtyToFulfill,
          batchId: batchId,
        })),
      });

      // 2. Update each order item individually
      for (const item of items) {
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            fulfilledQty: {
              increment: item.qtyToFulfill,
            },
          },
        });
      }
    },
    {
      maxWait: 10000, // default: 2000
      timeout: 20000, // default: 5000
    }
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
