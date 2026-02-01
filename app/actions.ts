'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. العملاء
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ take: 20, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

// البحث عن العملاء (Live Search Logic)
export async function searchCustomers(term: string) {
  if (!term) return [];
  const normalizedTerm = term.replace(/[أإآ]/g, 'ا');
  try {
    const customers = await prisma.$queryRaw`
      SELECT id, name, phone, "phone2", address, source 
      FROM "Customer"
      WHERE 
        TRANSLATE(name, 'أإآ', 'ااا') LIKE ${'%' + normalizedTerm + '%'}
        OR phone LIKE ${'%' + term + '%'}
        OR "phone2" LIKE ${'%' + term + '%'}
      LIMIT 50;
    `;
    return JSON.parse(JSON.stringify(customers));
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
}

// 2. الخزن
export async function getSafes() {
  try {
    const safes = await prisma.safe.findMany({ orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) { return []; }
}

// 3. البحث في المنتجات
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

// 4. حفظ الأوردر (تم التعديل لدعم العملة ✅)
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId, currency } = data; 
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // إنشاء الأوردر مع حفظ العملة المختارة
      const order = await tx.order.create({
        data: {
          userId, 
          customerId, 
          totalAmount: total, 
          deposit: deposit || 0,
          currency: currency || 'EGP', // 👈 حفظ العملة
          safeId: deposit > 0 ? safeId : null,
        }
      });

      // إضافة الأصناف
      for (const cartItem of items) {
        for (const variant of cartItem.variants) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: variant.productId,
              quantity: variant.quantity,
              price: variant.price,
              discountPercent: variant.discountPercent || 0
            }
          });

          // خصم المخزون
          await tx.product.update({
            where: { id: variant.productId },
            data: { stockQty: { decrement: variant.quantity } }
          });
        }
      }
      return order;
    });
    
    revalidatePath('/');
    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    console.error("Error creating order:", error);
    return null;
  }
}

// 5. جلب الأوردر للطباعة
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

// 6. إدارة النقدية (قبض - صرف - تحويل) - تم إضافة العملة ✅
export async function createPayment(data: any, userId: string) {
  const { 
    type, amount, currency, safeId, customerId, targetSafeId, description 
  } = data;

  try {
    await prisma.payment.create({ 
      data: { 
        type,
        amount, 
        currency: currency || 'EGP', // 👈 العملة المختارة
        safeId, 
        userId,
        customerId: customerId || null,
        targetSafeId: targetSafeId || null,
        description: description || ''
      } 
    });
    
    revalidatePath('/');
    return { success: true };
  } catch (error) { 
    console.error(error);
    return { success: false, error: 'فشل العملية' }; 
  }
}

// 7. الأوردرات السابقة
export async function getUserOrders(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let whereCondition = {};
    if (user?.role !== 'ADMIN' && user?.role !== 'OWNER') {
      whereCondition = { userId: userId };
    }
    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: { 
          customer: true, 
          user: true, 
          items: { include: { product: true } } 
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return { orders: JSON.parse(JSON.stringify(orders)), userRole: user?.role };
  } catch (error) { return { orders: [], userRole: 'EMPLOYEE' }; }
}

export async function deleteOrder(orderId: string) {
  try {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    revalidatePath('/orders/list');
    return { success: true };
  } catch (error) { return { success: false }; }
}

export async function getCurrentUser(userId: string) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return JSON.parse(JSON.stringify(user));
  } catch (error) { return null; }
}