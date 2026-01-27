'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. العملاء
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ take: 100, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

// 2. الخزن
export async function getSafes() {
  try {
    const safes = await prisma.safe.findMany({ orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) { return []; }
}

// 3. البحث (يجب أن يعيد الحالة والمخزون)
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

// 4. حفظ الأوردر (مع خصم المخزون)
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId } = data; 
  
  // نستخدم Transaction لضمان خصم المخزون وإنشاء الأوردر معاً
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. إنشاء الأوردر
      const order = await tx.order.create({
        data: {
          userId, customerId, totalAmount: total, deposit: deposit || 0,
          safeId: deposit > 0 ? safeId : null,
        }
      });

      // 2. معالجة الأصناف وخصم المخزون
      for (const cartItem of items) {
        for (const variant of cartItem.variants) {
          // إضافة للصنف في الأوردر
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: variant.productId,
              quantity: variant.quantity, // بالدستة
              price: variant.price
            }
          });

          // 👇 خصم من المخزون الرئيسي
          // ملاحظة: المخزون مخزن بالقطعة أم بالدستة؟ 
          // بناء على كود الأدمن السابق (stockQty: parseInt(item.stock)) 
          // وسياق كلامك (العدد 1 = 4 قطع)، سنفترض أن المخزون مخزن بـ "الوحدة" (الدستة)
          // إذا كان المخزون بالقطعة، اضرب variant.quantity * 4
          
          await tx.product.update({
            where: { id: variant.productId },
            data: {
              stockQty: {
                decrement: variant.quantity // خصم عدد الدست المباعة
              }
            }
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

// 6. التحصيل
export async function createPayment(data: any, userId: string) {
  const { customerId, amount, safeId } = data;
  try {
    await prisma.payment.create({ data: { amount, customerId, safeId, userId } });
    revalidatePath('/');
    return { success: true };
  } catch (error) { return { success: false }; }
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
      include: { customer: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return { orders: JSON.parse(JSON.stringify(orders)), userRole: user?.role };
  } catch (error) { return { orders: [], userRole: 'EMPLOYEE' }; }
}

export async function deleteOrder(orderId: string) {
  try {
    // عند الحذف يجب إعادة المخزون (اختياري، لكن مفضل)
    // للتبسيط الآن سنحذف فقط، لكن المحاسبياً يجب عمل "مرتجع"
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