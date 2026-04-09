'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

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

      // 2. Concurrently update all order items to improve performance
      const updatePromises = items.map(item =>
        tx.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            fulfilledQty: {
              increment: item.qtyToFulfill,
            },
          },
        })
      );
      await Promise.all(updatePromises);

    }, {
      maxWait: 10000, // Optional: Increase max wait time
      timeout: 20000, // Optional: Increase transaction timeout
    });

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
      // 1. Find all fulfillment logs for the given batch ID
      const logs = await tx.fulfillmentLog.findMany({
        where: { batchId: batchId },
      });

      if (logs.length === 0) {
        throw new Error('No logs found for this batch ID.');
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
      maxWait: 10000, // Optional: Increase max wait time
      timeout: 20000, // Optional: Increase transaction timeout
    });

    revalidatePath('/sorting');
    return { success: true };

  } catch (error) {
    console.error('Error undoing batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to undo batch';
    return { success: false, error: errorMessage };
  }
}
