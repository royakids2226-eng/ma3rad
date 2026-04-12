'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

type FulfillmentItem = {
  orderItemId: string;
  qtyToFulfill: number;
};

/**
 * Executes the sorting and fulfillment process directly in the database.
 * This provides an immediate response to the user.
 *
 * @param orderId - The ID of the order being processed.
 * @param items - An array of items to be fulfilled.
 * @returns An object indicating success and the batch ID, or an error.
 */
export async function processSortingBatchDirectly(orderId: string, items: FulfillmentItem[]) {
  if (!items || items.length === 0) {
    return { success: false, error: 'لا توجد أصناف للمعالجة' };
  }

  const batchId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create fulfillment logs for the new batch
      await tx.fulfillmentLog.createMany({
        data: items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.qtyToFulfill,
          batchId: batchId,
        })),
      });

      // 2. Concurrently update all associated order items
      const updatePromises = items.map((item) =>
        tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { fulfilledQty: { increment: item.qtyToFulfill } },
        })
      );
      await Promise.all(updatePromises);
    }, {
      maxWait: 20000, 
      timeout: 60000, 
    });

    // Revalidate paths to reflect the new data
    revalidatePath('/sorting');
    revalidatePath('/admin/reports'); // To update inventory reports as well

    return {
      success: true,
      message: 'تمت معالجة الكميات وخصمها من المخزن بنجاح.',
      batchId: batchId
    };

  } catch (error) {
    console.error('Error processing sorting batch:', error);
    return { success: false, error: 'فشل في تحديث بيانات الصرف في قاعدة البيانات' };
  }
}

/**
 * Reverts a fulfillment batch. This action is user-initiated and expected to be fast.
 *
 * @param batchId - The ID of the batch to undo.
 * @returns An object indicating success or failure.
 */
export async function undoOrderBatch(batchId: string) {
  if (!batchId) {
    return { success: false, error: 'Batch ID is required' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Find all fulfillment logs for the given batch ID
      const logs = await tx.fulfillmentLog.findMany({
        where: { batchId: batchId },
      });

      if (logs.length === 0) {
        throw new Error('لم يتم العثور على سجلات لهذا الباتش.');
      }

      // 2. Aggregate the quantities to be decremented for each order item
      const updates = new Map<string, number>();
      for (const log of logs) {
        updates.set(log.orderItemId, (updates.get(log.orderItemId) || 0) + log.quantity);
      }

      // 3. Concurrently decrement the fulfilled quantities for all affected items
      const updatePromises = Array.from(updates.entries()).map(([orderItemId, quantity]) =>
        tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            fulfilledQty: {
              decrement: quantity,
            },
          },
        })
      );
      await Promise.all(updatePromises);

      // 4. Delete the fulfillment logs for this batch
      await tx.fulfillmentLog.deleteMany({
        where: { batchId: batchId },
      });

    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    revalidatePath('/sorting');
    return { success: true };

  } catch (error) {
    console.error('Error undoing batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'فشل التراجع عن الباتش';
    return { success: false, error: errorMessage };
  }
}
