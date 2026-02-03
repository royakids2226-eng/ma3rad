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

// إنشاء أوردر جديد (مع التحقق من الرصيد وقفل التزامن)
export async function createOrder(data: any, userId: string) {
  const { customerId, items, total, deposit, safeId, currency } = data; 
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. التحقق من الأرصدة أولاً قبل إنشاء أي شيء
      // نقوم بفحص كل صنف في السلة
      for (const cartItem of items) {
        for (const variant of cartItem.variants) {
          
          // 🔥 خطوة القفل (Locking): هذا السطر يمنع التزامن
          // يقوم بحجز صف المنتج في قاعدة البيانات حتى تنتهي العملية
          // أي مستخدم آخر سيحاول القراءة سينتظر هنا
          await tx.$executeRawUnsafe(`SELECT 1 FROM "Product" WHERE id = $1 FOR UPDATE`, variant.productId);

          // جلب بيانات المنتج الحالية
          const product = await tx.product.findUnique({ 
            where: { id: variant.productId } 
          });

          if (!product) throw new Error(`المنتج غير موجود`);

          // إذا كان المنتج "مغلق"، نحسب الرصيد بدقة
          if (product.status !== 'OPEN') {
             // حساب إجمالي الكميات المباعة سابقاً (Units) لهذا المنتج
             const aggregate = await tx.orderItem.aggregate({
                where: { productId: variant.productId },
                _sum: { quantity: true }
             });

             const totalSoldUnits = aggregate._sum.quantity || 0;
             const totalSoldPieces = totalSoldUnits * PIECES_PER_UNIT;
             
             // الرصيد المتبقي (قطع)
             const remainingStock = product.stockQty - totalSoldPieces;
             
             // الكمية المطلوبة الآن (قطع)
             const requestedPieces = variant.quantity * PIECES_PER_UNIT;

             if (requestedPieces > remainingStock) {
                // 🛑 إطلاق خطأ لإلغاء العملية بالكامل
                throw new Error(`عذراً، الرصيد نفذ للصنف: ${product.modelNo} - ${product.color}. المتبقي: ${remainingStock} قطعة فقط.`);
             }
          }
        }
      }

      // 2. إذا نجح التحقق، نتابع إنشاء الأوردر
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
    // إرجاع رسالة الخطأ للفرونت إند لعرضها للمستخدم
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

// حذف الأوردر
export async function deleteOrder(orderId: string) {
  try {
    await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
    });
    revalidatePath('/orders/list');
    return { success: true };
  } catch (error) { return { success: false }; }
}

// تحديث الأوردر بالكامل (مع التحقق من الرصيد أيضاً)
export async function updateOrder(orderId: string, data: any) {
    const { items, total, deposit, safeId, currency } = data;
    try {
        await prisma.$transaction(async (tx) => {
            // 1. حذف الأصناف القديمة أولاً لتحرير الكميات
            await tx.orderItem.deleteMany({ where: { orderId } });

            // 2. التحقق من الرصيد للأصناف الجديدة (نفس منطق createOrder)
            for (const cartItem of items) {
              for (const variant of cartItem.variants) {
                // قفل المنتج
                await tx.$executeRawUnsafe(`SELECT 1 FROM "Product" WHERE id = $1 FOR UPDATE`, variant.productId);

                const product = await tx.product.findUnique({ where: { id: variant.productId } });
                if (!product) throw new Error(`المنتج غير موجود: ${variant.productId}`);

                if (product.status !== 'OPEN') {
                   const aggregate = await tx.orderItem.aggregate({
                      where: { productId: variant.productId },
                      _sum: { quantity: true }
                   });
                   const totalSoldUnits = aggregate._sum.quantity || 0;
                   const totalSoldPieces = totalSoldUnits * PIECES_PER_UNIT;
                   const remainingStock = product.stockQty - totalSoldPieces;
                   const requestedPieces = variant.quantity * PIECES_PER_UNIT;

                   if (requestedPieces > remainingStock) {
                      throw new Error(`عذراً، الرصيد نفذ للصنف: ${product.modelNo} - ${product.color}`);
                   }
                }

                // إنشاء الصنف
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

            // 3. تحديث رأس الأوردر
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
// 5. دوال التقارير (تم نقلها هنا لتجميع الملفات إذا لزم الأمر أو تركها كما هي)
// ==========================================
// ملاحظة: دوال getInventoryReport وغيرها موجودة في رد سابق، 
// إذا كان هذا الملف هو الملف المجمع لكل شيء فلا بأس، 
// ولكن تأكد من عدم تكرار الدوال إذا كانت موزعة على ملفين.
// الكود أعلاه يغطي فقط الدوال التي طلبت تعديلها للحماية (createOrder/updateOrder)
// وباقي دوال النظام الأساسية.
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
        const soldUnits = p.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
        const soldPieces = soldUnits * PIECES_PER_UNIT;
        const current = initial - soldPieces;

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
            totalSold: soldPieces,
            currentStock: current,
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