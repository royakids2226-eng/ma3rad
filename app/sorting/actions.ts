'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

type FulfillmentItem = {
  orderItemId: string;
  qtyToFulfill: number;
};

/**
 * Queues the sorting and fulfillment process to be run in the background.
 * Instead of processing immediately, it creates a 'Job' record in the database.
 * This provides an immediate response to the user and prevents serverless function timeouts.
 *
 * @param orderId - The ID of the order being processed.
 * @param items - An array of items to be fulfilled.
 * @returns An object indicating success and that the job is queued, or an error.
 */
export async function queueOrderBatchProcessing(orderId: string, items: FulfillmentItem[]) {
  if (!items || items.length === 0) {
    return { success: false, error: 'لا توجد أصناف للمعالجة' };
  }

  try {
    // Create a new job record in the database.
    // The actual processing will be handled by a separate background worker.
    const job = await prisma.job.create({
      data: {
        type: 'PROCESS_SORTING_BATCH',
        payload: { orderId, items }, // Store all necessary data for the job
        status: 'PENDING',
      },
    });

    // Return an immediate success response to the user.
    return {
      success: true,
      message: 'تم استلام الطلب. ستتم معالجته في الخلفية خلال دقيقة.',
      jobId: job.id
    };

  } catch (error) {
    console.error('Error queueing sorting job:', error);
    return { success: false, error: 'فشل في إضافة الطلب إلى قائمة انتظار المعالجة' };
  }
}

/**
 * This function contains the actual logic for processing a sorting batch.
 * It should ONLY be called by a trusted background worker or a cron job, not directly from the client.
 *
 * @param job - The job object from the database.
 */
export async function executeSortingJob(job: { id: string, payload: any }) {
    const { items } = job.payload;
    const batchId = randomUUID();

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Create fulfillment logs for all items in the batch
            await tx.fulfillmentLog.createMany({
                data: items.map((item: FulfillmentItem) => ({
                    orderItemId: item.orderItemId,
                    quantity: item.qtyToFulfill,
                    batchId: batchId,
                })),
            });

            // 2. Concurrently update all associated order items
            const updatePromises = items.map((item: FulfillmentItem) =>
                tx.orderItem.update({
                    where: { id: item.orderItemId },
                    data: { fulfilledQty: { increment: item.qtyToFulfill } },
                })
            );
            await Promise.all(updatePromises);
        }, {
            maxWait: 20000, // Allow up to 20s for the DB to be available
            timeout: 60000, // Allow up to 60s for the transaction to complete
        });

        // Mark job as completed and revalidate the path to update the UI
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'COMPLETED', result: { batchId } },
        });
        revalidatePath('/sorting');

    } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        // Mark job as failed with an error message
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'FAILED', result: { error: error instanceof Error ? error.message : 'Unknown processing error' } },
        });
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
