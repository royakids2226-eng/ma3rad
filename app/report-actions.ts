'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ==========================================
// 1. تقارير المخزون (Inventory)
// ==========================================

export async function getInventoryReport() {
  try {
    // جلب جميع الأصناف
    const products = await prisma.product.findMany({
      orderBy: { modelNo: 'asc' }
    });

    // تحويل البيانات لتناسب العرض
    const report = products.map(p => ({
      id: p.id,
      modelNo: p.modelNo,
      color: p.color,
      stockQty: p.stockQty, // عدد الدست المتبقية
      price: p.price,
      // قيمة البضاعة بسعر البيع (المخزون * 4 قطع * السعر)
      totalValue: p.stockQty * 4 * p.price, 
      status: p.status
    }));

    // إجماليات للملخص
    const summary = {
      totalItems: report.length,
      totalStockDozens: report.reduce((acc, item) => acc + item.stockQty, 0),
      totalValue: report.reduce((acc, item) => acc + item.totalValue, 0)
    };

    return { success: true, data: report, summary };
  } catch (e) {
    return { success: false, error: 'فشل جلب بيانات المخزون' };
  }
}

// ==========================================
// 2. تقارير الخزنة (Safe Ledger)
// ==========================================

export async function getSafesList() {
    const safes = await prisma.safe.findMany();
    return JSON.parse(JSON.stringify(safes));
}

export async function getSafeLedger(safeId: string, startDate?: string, endDate?: string) {
  try {
    // إعداد فلتر التاريخ
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // لنهاية اليوم
        dateFilter.lte = end;
    }

    // 1. جلب المدفوعات المباشرة (تحصيل نقدية)
    const payments = await prisma.payment.findMany({
      where: { 
          safeId,
          createdAt: startDate || endDate ? dateFilter : undefined
      },
      include: { customer: true, user: true }
    });

    // 2. جلب عربون الأوردرات (مقدمات)
    const orders = await prisma.order.findMany({
      where: { 
          safeId,
          deposit: { gt: 0 }, // فقط التي بها عربون
          createdAt: startDate || endDate ? dateFilter : undefined
      },
      include: { customer: true, user: true }
    });

    // 3. دمج العمليات في قائمة واحدة (Ledger)
    let transactions: any[] = [];

    // إضافة التحصيلات
    payments.forEach(p => {
        transactions.push({
            id: p.id,
            date: p.createdAt,
            type: 'تحصيل نقدية',
            description: `إيصال #${p.receiptNo} - ${p.customer.name}`,
            inAmount: p.amount,
            outAmount: 0,
            user: p.user.name
        });
    });

    // إضافة العرابين
    orders.forEach(o => {
        transactions.push({
            id: o.id,
            date: o.createdAt,
            type: 'عربون أوردر',
            description: `أوردر #${o.orderNo} - ${o.customer.name}`,
            inAmount: o.deposit,
            outAmount: 0,
            user: o.user.name
        });
    });

    // ترتيب العمليات حسب التاريخ (من الأقدم للأحدث) لحساب الرصيد التراكمي
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    const finalTransactions = transactions.map(t => {
        runningBalance += (t.inAmount - t.outAmount);
        return { ...t, balance: runningBalance };
    });

    return { 
        success: true, 
        data: finalTransactions, 
        totalIn: transactions.reduce((acc, t) => acc + t.inAmount, 0),
        currentBalance: runningBalance
    };

  } catch (e) {
    console.error(e);
    return { success: false, error: 'فشل جلب دفتر الخزنة' };
  }
}