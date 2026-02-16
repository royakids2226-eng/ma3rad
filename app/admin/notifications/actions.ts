'use server'

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// دالة لوضع علامة "تمت القراءة" في قاعدة البيانات
export async function markNotificationAsRead(productId: string) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isStockAlertRead: true }
    });
    
    // تحديث البيانات في صفحة الإشعارات فوراً
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false };
  }
}

// دالة لإعادة التعيين (اختياري)
export async function resetNotifications() {
  try {
    // إعادة تعيين فقط الأصناف التي مخزونها مازال منخفضاً ومغلقاً
    await prisma.product.updateMany({
      where: { 
        status: "CLOSED",
        currentStock: { lte: 4 },
        isStockAlertRead: true
      },
      data: { isStockAlertRead: false }
    });
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}