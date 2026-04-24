'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

type ActionResponse = {
    success: boolean;
    error?: string;
    batchId?: string;
};

/**
 * Process the sorting and fulfillment directly - OPTIMIZED FOR LARGE ORDERS
 */
export async function processSortingBatchDirectly(orderId: string, items: any[]): Promise<ActionResponse> {
  if (!items || items.length === 0) return { success: false, error: 'No items provided' };
  
  const batchId = randomUUID();
  
  try {
    // ✅ الحل الأول: استخدام Promise.all بشكل مجزأ (Batch Processing)
    const BATCH_SIZE = 10; // معالجة 10 عناصر في كل مرة
    
    // 1. إنشاء سجلات الـ FulfillmentLog على دفعات
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await prisma.fulfillmentLog.createMany({
        data: batch.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.qtyToFulfill,
          batchId: batchId,
        })),
      });
    }
    
    // 2. تحديث الـ OrderItems على دفعات
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const updatePromises = batch.map((item) =>
        prisma.orderItem.update({
          where: { id: item.orderItemId },
          data: { fulfilledQty: { increment: item.qtyToFulfill } },
        })
      );
      await Promise.all(updatePromises);
    }
    
    revalidatePath('/sorting');
    return { success: true, batchId };
    
  } catch (error: any) {
    console.error('❌ Error in processSortingBatchDirectly:', error);
    return { success: false, error: error.message || 'Failed to update' };
  }
}

// باقي الدوال كما هي بدون تغيير...
export async function bulkPostponeItems(orderItemIds: string[]): Promise<ActionResponse> {
  try {
    await (prisma.orderItem as any).updateMany({
      where: { id: { in: orderItemIds } },
      data: { isPostponed: true }
    });
    revalidatePath('/sorting');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to postpone items' };
  }
}

export async function bulkReactivateItems(orderItemIds: string[]): Promise<ActionResponse> {
  try {
    await (prisma.orderItem as any).updateMany({
      where: { id: { in: orderItemIds } },
      data: { isPostponed: false }
    });
    revalidatePath('/sorting');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to reactivate items' };
  }
}

export async function toggleBulkPostpone(orderItemIds: string[], status: boolean): Promise<ActionResponse> {
  try {
    await (prisma.orderItem as any).updateMany({
      where: { id: { in: orderItemIds } },
      data: { isPostponed: status }
    });
    revalidatePath('/sorting');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to change model status' };
  }
}

export async function undoOrderBatch(batchId: string): Promise<ActionResponse> {
  if (!batchId) return { success: false, error: 'Batch ID not provided' };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const logs = await tx.fulfillmentLog.findMany({ 
        where: { batchId: batchId } 
      });

      if (logs.length === 0) {
        throw new Error('No fulfillment logs found for this batch');
      }

      // معالجة التراجع على دفعات أيضاً
      const BATCH_SIZE = 10;
      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        const updatePromises = batch.map((log) =>
          tx.orderItem.update({
            where: { id: log.orderItemId },
            data: { fulfilledQty: { decrement: log.quantity } }
          })
        );
        await Promise.all(updatePromises);
      }

      await tx.fulfillmentLog.deleteMany({
        where: { batchId: batchId }
      });

      return { success: true };
    }, {
        maxWait: 30000,  // زيادة الوقت إلى 30 ثانية
        timeout: 60000   // زيادة المهلة إلى 60 ثانية
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

export async function undoLastBatchByOrder(orderId: string): Promise<ActionResponse> {
  try {
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

    return await undoOrderBatch(lastLog.batchId);

  } catch (error) {
    return { success: false, error: 'Failed to access fulfillment logs' };
  }
}