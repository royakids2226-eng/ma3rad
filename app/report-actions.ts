'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
// الدرزن أو الثرية تحتوي على 4 قطع (هذا هو معامل التحويل)
const PIECES_PER_UNIT = 4; 

// ==========================================
// 1. تقارير المخزون (حركة الأصناف) - تم تعديل الحسابات ✅
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
        // 1. مجموع الوحدات المباعة (درزن/ثرية) من جدول orderItems
        const totalSoldUnits = p.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // 2. تحويل المبيعات إلى قطع
        const totalSoldPieces = totalSoldUnits * PIECES_PER_UNIT;
        
        // 3. حساب إجمالي قيمة المبيعات (القطع المباعة × سعر القطعة)
        const totalSoldValue = p.orderItems.reduce((sum, item) => {
            return sum + (item.quantity * PIECES_PER_UNIT * item.price);
        }, 0);

        // 4. الرصيد الحالي (الموجود فعلياً في المخزن الآن بالقطعة)
        const currentStockPieces = p.stockQty;

        // 5. الرصيد الأولي (الثابت): هو ما تبقى في المخزن + ما تم بيعه فعلياً
        // هذا يضمن أن الرصيد الأولي لا ينقص عند البيع بل يمثل الكمية الافتتاحية
        const initialStockPieces = currentStockPieces + totalSoldPieces;

        const movementHistory = p.orderItems.map(item => ({
            orderId: item.orderId,
            orderNo: item.order.orderNo,
            date: item.order.createdAt,
            customer: item.order.customer.name,
            quantity: item.quantity * PIECES_PER_UNIT, // تحويل للعرض بالقطعة
            price: item.price
        }));

        return {
            id: p.id,
            modelNo: p.modelNo,
            color: p.color,
            initialStock: initialStockPieces, // الرصيد الافتتاحي (ثابت)
            totalSold: totalSoldPieces,       // إجمالي المباع بالقطعة
            totalSoldValue: totalSoldValue,   // إجمالي قيمة المبيعات
            currentStock: currentStockPieces, // الرصيد المتبقي حالياً
            price: p.price,
            currentValue: currentStockPieces * p.price, // قيمة البضاعة المتبقية
            status: p.status,
            history: movementHistory
        };
    });

    const summary = {
      totalItems: report.length,
      totalInitialStock: report.reduce((acc, item) => acc + item.initialStock, 0),
      totalCurrentStock: report.reduce((acc, item) => acc + item.currentStock, 0),
      totalSoldPieces: report.reduce((acc, item) => acc + item.totalSold, 0),
      totalSalesValue: report.reduce((acc, item) => acc + item.totalSoldValue, 0),
      totalValue: report.reduce((acc, item) => acc + item.currentValue, 0)
    };

    return { success: true, data: report, summary };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'فشل جلب بيانات المخزون' };
  }
}

// ==========================================
// 2. تقارير الخزنة (دفتر الأستاذ) - كامل بدون حذف
// ==========================================
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

// ==========================================
// 3. تقرير أداء الموظفين
// ==========================================
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
                        // نستخدم 4 قطع لكل وحدة بيع جملة
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