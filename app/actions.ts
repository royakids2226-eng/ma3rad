'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// --- العملاء والخزن ---
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ take: 100, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

export async function getSafes() {
  try {
    const safes = await prisma.safe.findMany({ orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) { return []; }
}

// --- المنتجات ---
export async function searchProducts(term: string) {
  if (!term || term.length < 2) return [];
  try {
    const products = await prisma.product.findMany({
      where: { modelNo: { contains: term, mode: 'insensitive' } },
      orderBy: { modelNo: 'asc' }
    });
    return JSON.parse(JSON.stringify(products));
  } catch (error) { return []; }
}

// --- الأوردرات ---
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId } = data; 
  const dbItems: any[] = [];
  
  items.forEach((cartItem: any) => {
    cartItem.variants.forEach((variant: any) => {
      dbItems.push({
        productId: variant.productId,
        quantity: variant.quantity,
        price: variant.price
      });
    });
  });

  try {
    const order = await prisma.order.create({
      data: {
        userId, customerId, totalAmount: total, deposit: deposit || 0,
        safeId: deposit > 0 ? safeId : null, 
        items: { create: dbItems }
      }
    });
    revalidatePath('/');
    return JSON.parse(JSON.stringify(order));
  } catch (error) { return null; }
}

export async function getOrderById(orderId: string) {
  if (!orderId) return null;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, user: true, items: { include: { product: true } } }
    });
    return JSON.parse(JSON.stringify(order));
  } catch (error) { return null; }
}

// 👇 دوال جديدة للأوردرات السابقة
export async function getUserOrders(userId: string) {
  try {
    // 1. نعرف رتبة الموظف
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    let whereCondition = {};
    
    // لو مش أدمن، يرجع أوردراته بس
    if (user?.role !== 'ADMIN') {
      whereCondition = { userId: userId };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: { customer: true, user: true }, // نحتاج اسم العميل واسم الموظف
      orderBy: { createdAt: 'desc' },
      take: 100 // آخر 100 أوردر عشان الأداء
    });

    // نرجع البيانات ومعها الرول عشان الواجهة تعرف تظهر زر الحذف ولا لا
    return {
      orders: JSON.parse(JSON.stringify(orders)),
      userRole: user?.role
    };

  } catch (error) {
    console.error(error);
    return { orders: [], userRole: 'EMPLOYEE' };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    // يجب حذف العناصر (Items) أولاً بسبب العلاقة
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    revalidatePath('/orders/list');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

// 👇 دالة حفظ الدفعة (Payment)
export async function createPayment(data: any, userId: string) {
  const { customerId, amount, safeId } = data;
  try {
    const payment = await prisma.payment.create({
      data: {
        amount,
        customerId,
        safeId,
        userId
      }
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}
// ... (أضف هذه الدالة في آخر الملف)

// 6. جلب بيانات المستخدم الحالي (للصفحة الرئيسية)
export async function getCurrentUser(userId: string) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    // تحويل البيانات لنصوص لتجنب أي مشاكل
    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    return null;
  }
}