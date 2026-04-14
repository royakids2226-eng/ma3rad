'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

// Add this definition at the top of the file to unify responses
type ActionResponse = {
    success: boolean;
    error?: string;
    batchId?: string;
};

/**
 * Process the sorting and fulfillment directly.
 */
export async function processSortingBatchDirectly(orderId: string, items: any[]): Promise<ActionResponse> {
  if (!items || items.length === 0) return { success: false, error: 'No items provided' };
  const batchId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fulfillmentLog.createMany({
        data: items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.qtyToFulfill,
          batchId: batchId,
        })),
      });
      const updatePromises = items.map((item) =>
        tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { fulfilledQty: { increment: item.qtyToFulfill } },
        })
      );
      await Promise.all(updatePromises);
    });
    revalidatePath('/sorting');
    return { success: true, batchId };
  } catch (error) {
    return { success: false, error: 'Failed to update' };
  }
}

/**
 * Postpone a collection of items at once.
 */
export async function bulkPostponeItems(orderItemIds: string[]): Promise<ActionResponse> {
  try {
    await prisma.orderItem.updateMany({
      where: { id: { in: orderItemIds } },
      data: { isPostponed: true }
    });
    revalidatePath('/sorting');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to postpone items' };
  }
}

/**
 * Toggle the postponement status for a group of items (the entire model).
 */
export async function toggleBulkPostpone(orderItemIds: string[], status: boolean): Promise<ActionResponse> {
  try {
    await prisma.orderItem.updateMany({
      where: { id: { in: orderItemIds } },
      data: { isPostponed: status }
    });
    revalidatePath('/sorting');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to change model status' };
  }
}

/**
 * Undo a specific fulfillment batch (stably and safely).
 */
export async function undoOrderBatch(batchId: string): Promise<ActionResponse> {
  if (!batchId) return { success: false, error: 'Batch ID not provided' };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch all logs associated with this batch
      const logs = await tx.fulfillmentLog.findMany({ 
        where: { batchId: batchId } 
      });

      if (logs.length === 0) {
        throw new Error('No fulfillment logs found for this batch');
      }

      // 2. Update the fulfilledQty for each item in the order (decrementing the undone quantity)
      for (const log of logs) {
        await tx.orderItem.update({
          where: { id: log.orderItemId },
          data: {
            fulfilledQty: {
              decrement: log.quantity // Decrement the fulfilled quantity
            }
          }
        });
      }

      // 3. Permanently delete the logs for this batch
      await tx.fulfillmentLog.deleteMany({
        where: { batchId: batchId }
      });

      return { success: true };
    }, {
        maxWait: 15000, 
        timeout: 30000 // Increase timeout to ensure processing of large orders
    });
    return result;

  } catch (error: any) {
    console.error('Undo Error:', error);
    return { 
      success: false, 
      error: error.message || 'A technical error occurred while trying to undo' 
    };
  } finally {
    revalidatePath('/sorting');
  }
}

/**
 * Undo the last fulfillment batch for an entire order.
 */
export async function undoLastBatchByOrder(orderId: string): Promise<ActionResponse> {
  try {
    // Find the most recent fulfillment log for this specific order
    const lastLog = await prisma.fulfillmentLog.findFirst({
      where: {
        orderItem: { orderId: orderId }
      },
      orderBy: { createdAt: 'desc' },
      select: { batchId: true }
    });

    if (!lastLog) {
      return { 
        success: false, 
        error: 'No previous fulfillment log found for this order (possibly an old order from before the system update)' 
      };
    }

    // Call the undo function using the batchId we found
    return await undoOrderBatch(lastLog.batchId);

  } catch (error) {
    return { success: false, error: 'Failed to access fulfillment logs' };
  }
}
