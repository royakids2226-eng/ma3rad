'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PIECES_PER_UNIT = 4; 

// ==========================================
// 1. تقارير المخزون (حركة الأصناف) - كامل بدون حذف
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
        const totalSold = p.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalSoldValue = p.orderItems.reduce((sum, item) => sum + (item.quantity * PIECES_PER_UNIT * item.price), 0);
        const currentStock = p.stockQty;
        const initialStock = currentStock + totalSold;

        const movementHistory = p.orderItems.map(item => ({
            orderId: item.orderId,
            orderNo: item.order.orderNo,
            date: item.order.createdAt,
            customer: item.order.customer.name,
            quantity: item.quantity,
            price: item.price
        }));

        return {
            id: p.id,
            modelNo: p.modelNo,
            color: p.color,
            initialStock: initialStock,
            totalSold: totalSold,
            totalSoldValue: totalSoldValue,
            currentStock: currentStock,
            price: p.price,
            currentValue: currentStock * p.price * PIECES_PER_UNIT, 
            status: p.status,
            history: movementHistory
        };
    });

    const summary = {
      totalItems: report.length,
      totalCurrentStock: report.reduce((acc, item) => acc + item.currentStock, 0),
      totalSoldUnits: report.reduce((acc, item) => acc + item.totalSold, 0),
      totalSalesValue: report.reduce((acc, item) => acc + item.totalSoldValue, 0),
      totalValue: report.reduce((acc, item) => acc + item.currentValue, 0)
    };

    return { success: true, data: report, summary };
  } catch (e) {
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

    // 1. جلب المدفوعات (وارد، صادر، تحويل)
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { safeId: safeId },
          { targetSafeId: safeId }
        ],
        createdAt: startDate || endDate ? dateFilter : undefined
      },
      include: { customer: true, user: true, safe: true, targetSafe: true }
    });

    // 2. جلب العربون من الأوردرات
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
        } else {
             typeLabel = 'تحصيل قديم';
             desc = `إيصال #${p.receiptNo}`;
             inAmt = p.amount;
        }

        transactions.push({
            id: p.id, 
            date: p.createdAt, 
            type: typeLabel,
            description: desc,
            inAmount: inAmt, 
            outAmount: outAmt, 
            user: p.user.name
        });
    });

    orders.forEach(o => {
        transactions.push({
            id: o.id, date: o.createdAt, type: 'عربون أوردر',
            description: `أوردر #${o.orderNo} - ${o.customer.name}`,
            inAmount: o.deposit, outAmount: 0, user: o.user.name
        });
    });

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const finalTransactions = transactions.map(t => {
        runningBalance += (t.inAmount - t.outAmount);
        return { ...t, balance: runningBalance };
    });

    return { 
        success: true, 
        data: finalTransactions, 
        totalIn: transactions.reduce((acc, t) => acc + t.inAmount, 0),
        totalOut: transactions.reduce((acc, t) => acc + t.outAmount, 0),
        currentBalance: runningBalance
    };

  } catch (e) {
    console.error(e);
    return { success: false, error: 'فشل جلب دفتر الخزنة' };
  }
}

// ==========================================
// 3. تقرير أداء الموظفين (تم التعديل لحساب الخصم من الأصناف)
// ==========================================
export async function getEmployeePerformance() {
    try {
        const users = await prisma.user.findMany({
            include: {
                orders: {
                    include: {
                        items: true // جلب الأصناف لحساب الخصومات بشكل دقيق
                    }
                }
            }
        });

        const report = users.map(user => {
            const orderCount = user.orders.length;
            const totalSales = user.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            
            // حساب إجمالي قيمة الخصومات التي منحها الموظف برمجياً من واقع الأصناف
            let totalDiscountValue = 0;
            user.orders.forEach(order => {
                order.items.forEach(item => {
                    if (item.discountPercent > 0) {
                        // السعر المخزن في item.price هو السعر النهائي بعد الخصم
                        const finalPrice = item.price;
                        const discountPct = item.discountPercent;
                        // المعادلة لاسترجاع السعر الأصلي: السعر الأصلي = السعر النهائي / (1 - نسبة الخصم)
                        const originalPrice = finalPrice / (1 - (discountPct / 100));
                        const discountPerPiece = originalPrice - finalPrice;
                        // الإجمالي = فرق السعر * الكمية (عدد الدست) * 4 قطع
                        totalDiscountValue += (discountPerPiece * item.quantity * PIECES_PER_UNIT);
                    }
                });
                // إذا كان هناك خصم إضافي مسجل على مستوى الأوردر (حقل discount) يتم إضافته أيضاً
                totalDiscountValue += (order.discount || 0);
            });

            return {
                id: user.id,
                name: user.name,
                code: user.code,
                role: user.role,
                orderCount,
                totalSales,
                totalDiscount: Math.round(totalDiscountValue) // تقريب الرقم لأقرب جنيه
            };
        }).filter(u => u.orderCount > 0);

        return { success: true, data: report };
    } catch (e) {
        console.error("Employee Performance Error:", e);
        return { success: false, error: 'فشل جلب أداء الموظفين' };
    }
}