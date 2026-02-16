'use server'

// 👇👇 التعديل هنا: إضافة الأقواس { } حول prisma
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function markNotificationAsRead(productId: string) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isStockAlertRead: true }
    });
    revalidatePath('/admin/notifications');
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

export async function resetNotifications() {
  try {
    await prisma.product.updateMany({
      where: { 
        status: "CLOSED", 
        currentStock: { lte: 4 },
        isStockAlertRead: true 
      },
      data: { isStockAlertRead: false }
    });
    revalidatePath('/admin/notifications');
  } catch (error) {
    console.error('Error resetting:', error);
  }
}