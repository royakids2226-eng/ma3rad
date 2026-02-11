'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs' 

const prisma = new PrismaClient()

// معامل التحويل (عدد القطع في الدزينة أو الوحدة)
const PIECES_PER_UNIT = 4; 

// ==========================================
// 1. العملاء (جلب وبحث وتحقق)
// ==========================================

export async function getCustomers() {
  try {
    // جلب أول 20 عميل للتحميل الأولي للصفحة
    const customers = await prisma.customer.findMany({ take: 20, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

export async function searchCustomers(term: string) {
  if (!term) return [];
  // تحسين البحث بمعالجة الهمزات لتطابق مرن
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

// 🆕 دالة جديدة للتحقق من وجود رقم الهاتف مسبقاً
export async function checkCustomerPhone(phone: string) {
  if (!phone || phone.length < 5) return { exists: false };
  
  try {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: { contains: phone } }, 
          { phone2: { contains: phone } }
        ]
      },
      select: { name: true, phone: true, phone2: true }
    });

    if (existingCustomer) {
      return { 
        exists: true, 
        name: existingCustomer.name,
        details: `الرقم مسجل باسم: ${existingCustomer.name}`
      };
    }

    return { exists: false };
  } catch (error) {
    console.error("Phone Check Error:", error);
    return { exists: false, error: "حدث خطأ أثناء التحقق" };
  }
}

// ==========================================
// 2. الخزن والمنتجات وتنبيهات المخزون
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

// 🆕 دالة لجلب تنبيهات المخزون للأدمن
export async function getAdminStockAlerts() {
  try {
    const lowStockItems = await prisma.product.findMany({
      where: {
        status: 'CLOSED',
        currentStock: {
          lte: 4 
        }
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        currentStock: true,
        description: true
      },
      orderBy: {
        currentStock: 'asc' 
      }
    });

    return {
      count: lowStockItems.length,
      items: JSON.parse(JSON.stringify(lowStockItems))
    };
  } catch (error) {
    console.error("Stock Alert Error:", error);
    return { count: 0, items: [] };
  }
}

// ==========================================
// 3. إدارة الأوردرات (Create, Get, Delete, Update)
// ==========================================

export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId, currency } = data; 
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      
      for (const cartItem of items) {
        for (const variant of cartItem.variants) {
          const requestedPieces = variant.quantity * PIECES_PER_UNIT;

          const product = await tx.product.findUnique({ where: { id: variant.productId } });
          if (!product) throw new Error(`الصنف غير موجود`);

          if (product.status !== 'OPEN' && product.currentStock < requestedPieces) {
             throw new Error(`عذراً، الكمية نفذت للصنف: ${product.modelNo} - لون: ${product.color} (المتاح حالياً: ${product.currentStock} قطعة فقط)`);
          }

          const updatedProduct = await tx.product.update({
            where: { id: variant.productId },
            data: { currentStock: { decrement: requestedPieces } }
          });
        }
      }

      const order = await tx.order.create({
        data: {
          userId, 
          customerId, 
          totalAmount: total, 
          deposit: deposit || 0,
          currency: currency || 'EGP',
          safeId: deposit > 0 ? safeId : null,
        }
      });

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
        }
      }
      return order;
    });
    
    revalidatePath('/');
    revalidatePath('/admin/products'); 
    revalidatePath('/admin/notifications'); // ✅ إضافة تحديث الإشعارات
    
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error creating order:", error);
    return { success: false, error: error.message || 'فشل إنشاء الطلب' };
  }
}

export async function getOrderById(orderId: string) {
  if (!orderId) return null;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
          customer: {
              include: {
                  payments: { orderBy: { createdAt: 'desc' } }
              }
          }, 
          user: true, 
          items: { include: { product: true } } 
      }
    });
    return JSON.parse(JSON.stringify(order));
  } catch (error) { return null; }
}

export async function deleteOrder(orderId: string) {
  try {
    await prisma.$transaction(async (tx) => {
        const orderItems = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of orderItems) {
           const piecesToReturn = item.quantity * PIECES_PER_UNIT;
           await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: piecesToReturn } }
           });
        }
        
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
    });
    revalidatePath('/orders/list');
    revalidatePath('/admin/notifications'); // ✅ تحديث الإشعارات عند الحذف
    return { success: true };
  } catch (error) { return { success: false }; }
}

export async function updateOrder(orderId: string, data: any) {
    const { items, total, deposit, safeId, currency } = data;
    try {
        await prisma.$transaction(async (tx) => {
            const oldItems = await tx.orderItem.findMany({ where: { orderId } });
            for (const item of oldItems) {
               const piecesToReturn = item.quantity * PIECES_PER_UNIT;
               await tx.product.update({
                  where: { id: item.productId },
                  data: { currentStock: { increment: piecesToReturn } }
               });
            }
            await tx.orderItem.deleteMany({ where: { orderId } });

            for (const cartItem of items) {
                for (const variant of cartItem.variants) {
                    const requestedPieces = variant.quantity * PIECES_PER_UNIT;
                    
                    const product = await tx.product.findUnique({ where: { id: variant.productId } });
                    
                    if (product && product.status !== 'OPEN' && product.currentStock < requestedPieces) {
                         throw new Error(`عذراً، الكمية نفذت للصنف: ${product.modelNo} - لون: ${product.color} (المتاح: ${product.currentStock})`);
                    }

                    await tx.product.update({
                        where: { id: variant.productId },
                        data: { currentStock: { decrement: requestedPieces } }
                    });

                    await tx.orderItem.create({
                        data: {
                            orderId: orderId,
                            productId: variant.productId,
                            quantity: variant.quantity,
                            price: variant.price,
                            discountPercent: variant.discountPercent || 0
                        }
                    });
                }
            }

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
        revalidatePath('/admin/notifications'); // ✅ تحديث الإشعارات عند التعديل
        return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}

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

export async function createPayment(data: any, userId: string) {
  const { type, amount, currency, safeId, customerId, targetSafeId, description } = data;
  try {
    await prisma.payment.create({ 
      data: { 
        type, 
        amount: parseFloat(amount), 
        currency: currency || 'EGP', 
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