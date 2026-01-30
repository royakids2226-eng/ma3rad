'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ثابت التحويل (لو كنت تستخدمه في مكان آخر، هنا سنعرض العدد كما هو مخزن)
// const PIECES_PER_UNIT = 4; 

// ==========================================
// 1. تقارير المخزون وحركة الصنف (Inventory & Movement)
// ==========================================

export async function getInventoryReport() {
  try {
    // جلب الأصناف مع تفاصيل مبيعاتها (OrderItems) والعميل المرتبط بكل بيعة
    const products = await prisma.product.findMany({
      orderBy: { modelNo: 'asc' },
      include: {
        orderItems: {
            include: {
                order: {
                    include: { customer: true }
                }
            }
        }
      }
    });

    // تحويل البيانات وحساب الحركة
    const report = products.map(p => {
        // 1. حساب إجمالي ما تم بيعه من هذا الصنف
        const totalSold = p.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // 2. الرصيد الحالي (الموجود في الخانة stockQty)
        const currentStock = p.stockQty;

        // 3. استنتاج الرصيد الأولي (بافتراض: الأولي = الحالي + ما تم بيعه)
        // (هذا الرقم دقيق طالما لم يتم إضافة بضاعة جديدة، لو تم إضافة بضاعة سيعتبرها جزء من الأولي)
        const initialStock = currentStock + totalSold;

        // 4. تجهيز تفاصيل الحركة (للعرض عند الضغط)
        const movementHistory = p.orderItems.map(item => ({
            orderId: item.orderId,
            orderNo: item.order.orderNo,
            date: item.order.createdAt,
            customer: item.order.customer.name,
            quantity: item.quantity,
            price: item.price // سعر البيع في وقتها
        }));

        return {
            id: p.id,
            modelNo: p.modelNo,
            color: p.color,
            
            initialStock: initialStock, // الرصيد الأولي
            totalSold: totalSold,       // الخارج (مبيعات)
            currentStock: currentStock, // الرصيد الحالي
            
            price: p.price,
            // القيمة الحالية = الرصيد الحالي * السعر
            // (أزلت الضرب في 4 بناء على طلبك بأن الكمية قطعة)
            currentValue: currentStock * p.price, 
            
            status: p.status,
            history: movementHistory // التفاصيل
        };
    });

    // إجماليات للملخص
    const summary = {
      totalItems: report.length,
      totalCurrentStock: report.reduce((acc, item) => acc + item.currentStock, 0),
      totalSoldUnits: report.reduce((acc, item) => acc + item.totalSold, 0),
      totalValue: report.reduce((acc, item) => acc + item.currentValue, 0)
    };

    return { success: true, data: report, summary };
  } catch (e) {
    console.error(e);
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
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); 
        dateFilter.lte = end;
    }

    const payments = await prisma.payment.findMany({
      where: { safeId, createdAt: startDate || endDate ? dateFilter : undefined },
      include: { customer: true, user: true }
    });

    const orders = await prisma.order.findMany({
      where: { safeId, deposit: { gt: 0 }, createdAt: startDate || endDate ? dateFilter : undefined },
      include: { customer: true, user: true }
    });

    let transactions: any[] = [];

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
        currentBalance: runningBalance
    };

  } catch (e) {
    return { success: false, error: 'فشل جلب دفتر الخزنة' };
  }
}