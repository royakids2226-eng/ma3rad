'use server'

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function getInventoryReport() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { modelNo: 'asc' },
      include: {
        orderItems: {
          include: { 
            order: { include: { customer: true } },
            returnItems: true
          }
        }
      }
    });

    const report = products.map(p => {
        const initial = p.stockQty || 0;
        
        const totalSoldFromOrders = p.orderItems.reduce(
            (acc, item) => acc + (item.quantity || 0), 0
        );
        
        const totalReturned = p.orderItems.reduce(
            (acc, item) => acc + (item.returnItems?.reduce((sum, ret) => sum + ret.quantity, 0) || 0), 0
        );
        
        const totalSoldPieces = totalSoldFromOrders - totalReturned;
        const logicalCurrentStock = initial - totalSoldPieces;

        return {
            id: p.id,
            modelNo: p.modelNo,
            vendor: p.vendor,
            color: p.color,
            initialStock: initial,
            totalSold: totalSoldPieces,
            currentStock: logicalCurrentStock,
            totalSoldValue: p.orderItems.reduce((acc, item) => {
                const itemSold = (item.quantity || 0) - (item.returnItems?.reduce((sum, ret) => sum + ret.quantity, 0) || 0);
                return acc + (itemSold * (item.price || 0));
            }, 0),
            currentValue: logicalCurrentStock * (p.price || 0),
            price: p.price,
            status: p.status,
            history: p.orderItems.map(item => ({
                orderNo: item.order.orderNo,
                date: item.order.createdAt,
                customer: item.order.customer.name,
                quantity: item.quantity,
                price: item.price
            }))
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
    return { success: false, error: 'فشل جلب البيانات' };
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
        createdAt: startDate || endDate ? dateFilter : undefined,
      },
      include: { customer: true, user: true, safe: true, targetSafe: true }
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
             desc = p.description || (p.customer ? `إيصال #${p.receiptNo} - ${custName}` : `إيصال #${p.receiptNo}`);
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
        } else if (p.type === 'PAYMENT_COLLECTION') {
            typeLabel = 'تحصيل أوردر';
            desc = p.description;
            inAmt = p.amount;
        } else if (p.type === 'VOUCHER') {
            // نتجاهل قسائم المشتريات لأنها خصم ظاهري ولا تؤثر على النقدية
            return;
        }


        if (typeLabel) {
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
        }
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
                        totalDiscountValue += (discountPerPiece * (item.quantity || 0));
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