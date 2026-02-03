'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs' 

const prisma = new PrismaClient()

// ==========================================
// 1. العملاء (جلب وبحث)
// ==========================================
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ take: 20, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

// البحث عن العملاء (تجاهل الهمزات + البحث بالهواتف)
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

// ==========================================
// 2. الخزن والمنتجات
// ==========================================
export async function getSafes() {
  try {
    const safes = await prisma.safe.findMany({ orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) { return []; }
}

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

// ==========================================
// 3. إدارة الأوردرات (إنشاء - جلب - حذف - تحديث)
// ==========================================

// إنشاء أوردر جديد (دعم العملة)
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId, currency } = data; 
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. إنشاء الأوردر مع حفظ العملة
      const order = await tx.order.create({
        data: {
          userId, 
          customerId, 
          totalAmount: total, 
          deposit: deposit || 0,
          currency: currency || 'EGP', // 👈 حفظ العملة المختارة
          safeId: deposit > 0 ? safeId : null,
        }
      });

      // 2. إضافة الأصناف وخصم المخزون
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

          await tx.product.update({
            where: { id: variant.productId },
            data: {
              stockQty: { decrement: variant.quantity }
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

// جلب الأوردر للطباعة أو التعديل (يشمل جلب كافة مدفوعات العميل للفاتورة)
export async function getOrderById(orderId: string) {
  if (!orderId) return null;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
          customer: {
              include: {
                  payments: { orderBy: { createdAt: 'desc' } } // 👈 جلب المدفوعات لفصل العملات في الفاتورة
              }
          }, 
          user: true, 
          items: { include: { product: true } } 
      }
    });
    return JSON.parse(JSON.stringify(order));
  } catch (error) { return null; }
}

// حذف الأوردر (مع إرجاع الكميات للمخزن)
export async function deleteOrder(orderId: string) {
  try {
    await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (order) {
            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQty: { increment: item.quantity } }
                });
            }
        }
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
    });
    revalidatePath('/orders/list');
    return { success: true };
  } catch (error) { return { success: false }; }
}

// تحديث الأوردر بالكامل (إرجاع المخزون القديم وحفظ الجديد)
export async function updateOrder(orderId: string, data: any) {
    const { items, total, deposit, safeId, currency } = data;
    try {
        await prisma.$transaction(async (tx) => {
            // 1. إرجاع المخزون القديم
            const oldOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });
            if (oldOrder) {
                for (const item of oldOrder.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: { increment: item.quantity } }
                    });
                }
            }
            // 2. حذف الأصناف القديمة
            await tx.orderItem.deleteMany({ where: { orderId } });
            // 3. إضافة الأصناف الجديدة وخصم المخزون
            for (const cartItem of items) {
                for (const variant of cartItem.variants) {
                    await tx.orderItem.create({
                        data: {
                            orderId: orderId,
                            productId: variant.productId,
                            quantity: variant.quantity,
                            price: variant.price,
                            discountPercent: variant.discountPercent || 0
                        }
                    });
                    await tx.product.update({
                        where: { id: variant.productId },
                        data: { stockQty: { decrement: variant.quantity } }
                    });
                }
            }
            // 4. تحديث رأس الأوردر
            await tx.order.update({
                where: { id: orderId },
                data: {
                    totalAmount: total,
                    deposit: deposit || 0,
                    currency: currency || 'EGP',
                    safeId: deposit > 0 ? safeId : null
                }
            });
        });
        revalidatePath('/orders/list');
        return { success: true };
    } catch (error) { return { success: false }; }
}

// جلب سجل الأوردرات
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

// ==========================================
// 4. إدارة النقدية والموظفين
// ==========================================

// إنشاء تحصيل أو صرف (دعم العملة)
export async function createPayment(data: any, userId: string) {
  const { type, amount, currency, safeId, customerId, targetSafeId, description } = data;
  try {
    await prisma.payment.create({ 
      data: { 
        type, 
        amount: parseFloat(amount), 
        currency: currency || 'EGP', // 👈 حفظ العملة
        safeId, 
        userId,
        customerId: customerId || null,
        targetSafeId: targetSafeId || null,
        description: description || ''
      } 
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) { return { success: false, error: 'فشل العملية' }; }
}

// تسجيل موظف جديد من شاشة اللوجن
export async function registerEmployee(data: any) {
  try {
    const { code, name, password } = data;
    const existingUser = await prisma.user.findUnique({ where: { code } });
    if (existingUser) return { success: false, error: 'كود الموظف مستخدم بالفعل' };

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { code, name, password: hashedPassword, role: 'EMPLOYEE' }
    });
    return { success: true };
  } catch (e) { return { success: false, error: 'حدث خطأ أثناء التسجيل' }; }
}

export async function getCurrentUser(userId: string) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return JSON.parse(JSON.stringify(user));
  } catch (error) { return null; }
}