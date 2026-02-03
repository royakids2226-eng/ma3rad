// app/report-actions.ts
'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs' 

const prisma = new PrismaClient()
const PIECES_PER_UNIT = 4; // معامل التحويل: كل وحدة مبيعات تساوي 4 قطع

// ==========================================
// 1. العملاء (جلب وبحث)
// ==========================================
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({ take: 20, orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) { return []; }
}

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

// إنشاء أوردر جديد (نظام الخصم الذري الآمن)
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId, currency } = data; 
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. محاولة خصم الكميات مباشرة من الرصيد
      for (const cartItem of items) {
        for (const variant of cartItem.variants) {
          
          const requestedPieces = variant.quantity * PIECES_PER_UNIT;

          // جملة التحديث الذرية (Atomic Update)
          // تحاول إنقاص الرصيد فقط إذا كان (الرصيد الحالي >= المطلوب)
          const updateResult = await tx.product.updateMany({
            where: {
              id: variant.productId,
              currentStock: { gte: requestedPieces } // الشرط الحاسم
            },
            data: {
              currentStock: { decrement: requestedPieces }
            }
          });

          // إذا كانت نتيجة التحديث 0، فهذا يعني أن الشرط لم يتحقق (الرصيد لا يكفي)
          if (updateResult.count === 0) {
             const product = await tx.product.findUnique({ where: { id: variant.productId } });
             throw new Error(`عذراً، الرصيد نفذ للصنف: ${product?.modelNo} - ${product?.color}. المتاح: ${product?.currentStock} قطعة.`);
          }
        }
      }

      // 2. إذا نجح الخصم، ننشئ الأوردر
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

      // 3. إضافة الأصناف
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
    return { success: true, data: JSON.parse(JSON.stringify(result)) };

  } catch (error: any) {
    console.error("Error creating order:", error);
    return { success: false, error: error.message || 'حدث خطأ أثناء حفظ الطلب' };
  }
}

// جلب الأوردر للطباعة أو التعديل
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

// حذف الأوردر (مع استرجاع الكميات للمخزون)
export async function deleteOrder(orderId: string) {
  try {
    await prisma.$transaction(async (tx) => {
        // 1. جلب الأصناف لمعرفة الكميات التي يجب إرجاعها
        const orderItems = await tx.orderItem.findMany({
           where: { orderId }
        });

        // 2. إرجاع الكميات للمخزون
        for (const item of orderItems) {
           const piecesToReturn = item.quantity * PIECES_PER_UNIT;
           await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: piecesToReturn } }
           });
        }

        // 3. حذف الأصناف والأوردر
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
    });
    revalidatePath('/orders/list');
    return { success: true };
  } catch (error) { return { success: false }; }
}

// تحديث الأوردر (إرجاع القديم ثم خصم الجديد)
export async function updateOrder(orderId: string, data: any) {
    const { items, total, deposit, safeId, currency } = data;
    try {
        await prisma.$transaction(async (tx) => {
            // 1. جلب الأصناف القديمة
            const oldItems = await tx.orderItem.findMany({ where: { orderId } });

            // 2. إرجاع كميات الأصناف القديمة للمخزون
            for (const item of oldItems) {
               const piecesToReturn = item.quantity * PIECES_PER_UNIT;
               await tx.product.update({
                  where: { id: item.productId },
                  data: { currentStock: { increment: piecesToReturn } }
               });
            }

            // 3. حذف الأصناف القديمة من الجدول
            await tx.orderItem.deleteMany({ where: { orderId } });

            // 4. خصم الكميات الجديدة (بنفس منطق الإنشاء الآمن)
            for (const cartItem of items) {
              for (const variant of cartItem.variants) {
                const requestedPieces = variant.quantity * PIECES_PER_UNIT;
                
                const updateResult = await tx.product.updateMany({
                    where: {
                      id: variant.productId,
                      currentStock: { gte: requestedPieces }
                    },
                    data: {
                      currentStock: { decrement: requestedPieces }
                    }
                });

                if (updateResult.count === 0) {
                   const product = await tx.product.findUnique({ where: { id: variant.productId } });
                   throw new Error(`عذراً، التعديل مرفوض. الرصيد لا يكفي للصنف: ${product?.modelNo} - ${product?.color}. المتاح: ${product?.currentStock}`);
                }

                // إنشاء الصنف الجديد
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

            // 5. تحديث رأس الأوردر
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
    } catch (error: any) { 
        return { success: false, error: error.message || 'فشل التحديث' }; 
    }
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

// إنشاء تحصيل أو صرف
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

// تسجيل موظف جديد
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

// ==========================================
// 5. تقارير الجرد
// ==========================================
export async function getInventoryReport() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { modelNo: 'asc' },
      include: {
        orderItems: {
            include: { order: { include: { customer: true } } }
        }
      }
    });

    const report = products.map(p => {
        const initial = p.stockQty || 0;
        
        // الآن الرصيد الحالي يأتي مباشرة من قاعدة البيانات وهو الأدق
        const current = p.currentStock;
        
        // المباع هو الفرق بين الأولي والحالي
        const totalSoldPieces = initial - current;

        // القيمة المباعة (تاريخياً من الأوردرات)
        const soldValue = p.orderItems.reduce((acc, item) => {
            return acc + ((item.quantity || 0) * PIECES_PER_UNIT * (item.price || 0));
        }, 0);

        const history = p.orderItems.map(item => ({
            orderId: item.orderId,
            orderNo: item.order.orderNo,
            date: item.order.createdAt,
            customer: item.order.customer.name,
            quantity: (item.quantity || 0) * PIECES_PER_UNIT,
            price: item.price
        }));

        return {
            id: p.id,
            modelNo: p.modelNo,
            color: p.color,
            initialStock: initial,
            totalSold: totalSoldPieces,
            currentStock: current, // القيمة الحقيقة من العمود الجديد
            totalSoldValue: soldValue,
            currentValue: current * (p.price || 0),
            price: p.price,
            status: p.status,
            history: history
        };
    });

    const summary = {
      totalItems: report.length,
      totalInitialStock: report.reduce((acc, item) => acc + item.initialStock, 0),
      totalCurrentStock: report.reduce((acc, item) => acc + item.currentStock, 0),
      totalSoldUnits: report.reduce((acc, item) => acc + item.totalSold, 0), 
      totalSalesValue: report.reduce((acc, item) => acc + item.totalSoldValue, 0),
      totalValue: report.reduce((acc, item) => acc + item.currentValue, 0)
    };

    return { success: true, data: report, summary };
  } catch (e) {
    console.error("Inventory Report Error:", e);
    return { success: false, error: 'فشل جلب بيانات المخزون' };
  }
}

export async function getSafesList() {
    const safes = await prisma.safe.findMany();
    return JSON.parse(JSON.stringify(safes));
}

export async function getSafeLedger(safeId: string, startDate?: string, endDate?: string) {
  try {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); 
        dateFilter.lte = end;
    }

    const payments = await prisma.payment.findMany({
      where: {
        OR: [ { safeId: safeId }, { targetSafeId: safeId } ],
        createdAt: startDate || endDate ? dateFilter : undefined
      },
      include: { customer: true, user: true, safe: true, targetSafe: true }
    });

    const orders = await prisma.order.findMany({
      where: { safeId, deposit: { gt: 0 }, createdAt: startDate || endDate ? dateFilter : undefined },
      include: { customer: true, user: true }
    });

    let transactions: any[] = [];

    payments.forEach((p: any) => {
        let desc = '';
        let inAmt = 0;
        let outAmt = 0;
        let typeLabel = '';

        if (p.type === 'IN') {
             typeLabel = 'سند قبض';
             const custName = p.customer?.name || 'عميل';
             desc = p.customer ? `إيصال #${p.receiptNo} - ${custName}` : `إيصال #${p.receiptNo}`;
             inAmt = p.amount;
        } else if (p.type === 'OUT') {
             typeLabel = 'سند صرف';
             desc = p.description || 'مصروفات';
             outAmt = p.amount;
        } else if (p.type === 'TRANSFER') {
             if (p.safeId === safeId) {
                typeLabel = 'تحويل صادر';
                const targetName = p.targetSafe?.name || 'غير معروف';
                desc = `تحويل إلى: ${targetName} - ${p.description || ''}`;
                outAmt = p.amount;
             } else {
                typeLabel = 'تحويل وارد';
                const sourceName = p.safe?.name || 'غير معروف';
                desc = `تحويل من: ${sourceName} - ${p.description || ''}`;
                inAmt = p.amount;
             }
        }

        transactions.push({
            id: p.id, 
            date: p.createdAt, 
            type: typeLabel,
            description: desc,
            currency: p.currency || 'EGP',
            inAmount: inAmt, 
            outAmount: outAmt, 
            user: p.user.name
        });
    });

    orders.forEach(o => {
        transactions.push({
            id: o.id, date: o.createdAt, type: 'عربون أوردر',
            description: `أوردر #${o.orderNo} - ${o.customer.name}`,
            currency: o.currency || 'EGP',
            inAmount: o.deposit, outAmount: 0, user: o.user.name
        });
    });

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const summaryByCurrency: any = {};
    transactions.forEach(t => {
        const curr = t.currency;
        if (!summaryByCurrency[curr]) {
            summaryByCurrency[curr] = { in: 0, out: 0, balance: 0 };
        }
        summaryByCurrency[curr].in += t.inAmount;
        summaryByCurrency[curr].out += t.outAmount;
        summaryByCurrency[curr].balance += (t.inAmount - t.outAmount);
    });

    return { 
        success: true, 
        data: transactions, 
        summaryGrouped: summaryByCurrency 
    };

  } catch (e) {
    console.error(e);
    return { success: false, error: 'فشل جلب دفتر الخزنة' };
  }
}

export async function getEmployeePerformance() {
    try {
        const users = await prisma.user.findMany({
            include: {
                orders: {
                    include: { items: true }
                }
            }
        });

        const report = users.map(user => {
            const orderCount = user.orders.length;
            const totalSales = user.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            
            let totalDiscountValue = 0;
            user.orders.forEach(order => {
                order.items.forEach(item => {
                    if (item.discountPercent > 0) {
                        const finalPrice = item.price;
                        const discountPct = item.discountPercent;
                        const originalPrice = finalPrice / (1 - (discountPct / 100));
                        const discountPerPiece = originalPrice - finalPrice;
                        totalDiscountValue += (discountPerPiece * item.quantity * PIECES_PER_UNIT);
                    }
                });
                totalDiscountValue += (order.discount || 0);
            });

            return {
                id: user.id,
                name: user.name,
                code: user.code,
                role: user.role,
                orderCount,
                totalSales,
                totalDiscount: Math.round(totalDiscountValue)
            };
        }).filter(u => u.orderCount > 0);

        return { success: true, data: report };
    } catch (e) {
        return { success: false, error: 'فشل جلب أداء الموظفين' };
    }
}