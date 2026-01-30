'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PIECES_PER_UNIT = 4; 

// 1. تقارير المخزون
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

// 2. تقارير الخزنة
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
            id: p.id, date: p.createdAt, type: 'تحصيل نقدية',
            description: `إيصال #${p.receiptNo} - ${p.customer.name}`,
            inAmount: p.amount, outAmount: 0, user: p.user.name
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
        currentBalance: runningBalance
    };

  } catch (e) {
    return { success: false, error: 'فشل جلب دفتر الخزنة' };
  }
}

// 3. 👇 تقرير أداء الموظفين (الجديد)
export async function getEmployeePerformance() {
    try {
        const users = await prisma.user.findMany({
            include: {
                orders: {
                    select: {
                        totalAmount: true,
                        discount: true
                    }
                }
            }
        });

        const report = users.map(user => {
            const orderCount = user.orders.length;
            const totalSales = user.orders.reduce((sum, o) => sum + o.totalAmount, 0);
            const totalDiscount = user.orders.reduce((sum, o) => sum + (o.discount || 0), 0);

            return {
                id: user.id,
                name: user.name,
                code: user.code,
                role: user.role,
                orderCount,
                totalSales,
                totalDiscount
            };
        }).filter(u => u.orderCount > 0); // إظهار من له مبيعات فقط

        return { success: true, data: report };
    } catch (e) {
        return { success: false, error: 'فشل جلب أداء الموظفين' };
    }
}