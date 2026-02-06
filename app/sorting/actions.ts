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