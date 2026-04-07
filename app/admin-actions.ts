'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ==========================================
// 1. إدارة المستخدمين (Users)
// ==========================================

export async function addUser(data: any) {
  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await prisma.user.create({
      data: {
        code: data.code,
        name: data.name,
        password: hashedPassword,
        role: data.role
      }
    });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'الكود مستخدم من قبل' };
  }
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function getUsers() {
  const users = await prisma.user.findMany({ orderBy: { id: 'desc' } });
  return JSON.parse(JSON.stringify(users));
}

// ==========================================
// 2. إدارة المنتجات (Products)
// ==========================================

export async function addProduct(data: any) {
  try {
    for (const item of data.colors) {
        await prisma.product.create({
            data: {
                modelNo: data.modelNo,
                description: data.description,
                material: data.material,
                price: parseFloat(data.price),
                discount: parseFloat(data.discount) || 0, 
                color: item.color,
                stockQty: parseInt(item.stock),
                currentStock: parseInt(item.stock), 
                status: data.status || 'OPEN'
            }
        });
    }
    revalidatePath('/admin/products');
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'حدث خطأ، ربما البيانات مكررة' };
  }
}

export async function updateProduct(id: string, data: any) {
    try {
        await prisma.product.update({
            where: { id },
            data: {
                modelNo: data.modelNo,
                description: data.description,
                material: data.material,
                color: data.color,
                price: parseFloat(data.price),
                discount: parseFloat(data.discount) || 0,
                stockQty: parseInt(data.stockQty),
                status: data.status
            }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/notifications');
        return { success: true };
    } catch (e) {
        return { success: false, error: 'فشل التعديل' };
    }
}

export async function addBulkProducts(products: any[]) {
    try {
        let count = 0;
        for (const p of products) {
            if(p.modelNo && p.color) {
                const productStatus = (p.status && p.status.toUpperCase() === 'CLOSED') ? 'CLOSED' : 'OPEN';
                
                await prisma.product.upsert({
                    where: {
                        modelNo_color: {
                            modelNo: String(p.modelNo),
                            color: String(p.color)
                        }
                    },
                    update: {
                        stockQty: parseInt(p.stockQty) || 0,
                        price: parseFloat(p.price) || 0,
                        discount: parseFloat(p.discount) || 0,
                        description: p.description || '',
                        status: productStatus
                    },
                    create: {
                        modelNo: String(p.modelNo),
                        description: p.description || '',
                        material: p.material || '',
                        color: String(p.color),
                        price: parseFloat(p.price) || 0,
                        discount: parseFloat(p.discount) || 0,
                        stockQty: parseInt(p.stockQty) || 0,
                        currentStock: parseInt(p.stockQty) || 0, 
                        status: productStatus
                    }
                });
                count++;
            }
        }
        revalidatePath('/admin/products');
        revalidatePath('/admin/notifications');
        return { success: true, count };
    } catch (e) {
        return { success: false, error: 'حدث خطأ أثناء الاستيراد' };
    }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin/products');
    revalidatePath('/admin/notifications');
    return { success: true };
  } catch (e) { 
      return { success: false, error: 'لا يمكن حذف الصنف لأنه موجود في طلبات سابقة' }; 
  }
}

export async function deleteBulkProducts(ids: string[]) {
    try {
        const res = await prisma.product.deleteMany({
            where: {
                id: { in: ids },
                orderItems: { none: {} }
            }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/notifications');
        return { success: true, deleted: res.count, failed: ids.length - res.count };
    } catch (e) {
        return { success: false, error: 'حدث خطأ أثناء الحذف' };
    }
}

export async function deleteAllProducts() {
    try {
        const res = await prisma.product.deleteMany({
            where: {
                orderItems: { none: {} }
            }
        });
        const remaining = await prisma.product.count();
        revalidatePath('/admin/products');
        revalidatePath('/admin/notifications');
        return { success: true, deleted: res.count, failed: remaining };
    } catch (e) { return { success: false, error: 'حدث خطأ غير متوقع' }; }
}

export async function getProducts() {
  const products = await prisma.product.findMany({ orderBy: { id: 'desc' }, take: 5000 });
  return JSON.parse(JSON.stringify(products));
}

// ==========================================
// 3. إدارة العملاء (Customers)
// ==========================================

export async function addCustomer(data: any) {
    try {
      const { name, phone, phone2, code, source, force } = data;
      const normalizedInputName = name.replace(/[أإآ]/g, 'ا');
      const existingByName: any[] = await prisma.$queryRaw`
        SELECT name FROM "Customer" 
        WHERE TRANSLATE(name, 'أإآ', 'ااا') = ${normalizedInputName}
        LIMIT 1
      `;
      
      if (existingByName.length > 0) {
          return { success: false, error: `الاسم موجود مسبقاً باسم: (${existingByName[0].name})` };
      }

      if (!force) {
          const phonesToCheck = [phone, phone2].filter(p => p && p.trim() !== "");
          if (phonesToCheck.length > 0) {
              const existingByPhone = await prisma.customer.findFirst({
                  where: {
                      OR: [
                          { phone: { in: phonesToCheck } },
                          { phone2: { in: phonesToCheck } },
                          { phone: { in: phonesToCheck.map(p => p) } } 
                      ]
                  },
                  select: { name: true }
              });

              if (existingByPhone) {
                  return { success: false, warning: true, existingName: existingByPhone.name };
              }
          }
      }

      let finalCode = code;
      if (!finalCode || finalCode.trim() === "") {
        finalCode = "C-" + Date.now().toString().slice(-6);
      }

      const customer = await prisma.customer.create({ 
          data: {
              code: finalCode,
              name: name,
              phone: phone || null,
              phone2: phone2 || null,
              address: data.address || '',
              source: source || 'ADMIN'
          } 
      });
      revalidatePath('/admin/customers');
      return { success: true, customer: JSON.parse(JSON.stringify(customer)) };
    } catch (e) { 
        return { success: false, error: 'كود العميل مكرر أو خطأ في البيانات' }; 
    }
}

export async function updateCustomer(id: string, data: any) {
    try {
        await prisma.customer.update({
            where: { id },
            data: {
                code: data.code,
                name: data.name,
                phone: data.phone,
                phone2: data.phone2,
                address: data.address
            }
        });
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (e) { return { success: false, error: 'حدث خطأ أثناء التعديل' }; }
}

export async function addBulkCustomers(customers: any[]) {
    try {
        let count = 0;
        for (const c of customers) {
            if(c.code && c.name) {
                await prisma.customer.upsert({
                    where: { code: String(c.code) },
                    update: {
                        name: c.name,
                        phone: String(c.phone || ''),
                        phone2: String(c.phone2 || ''),
                        address: c.address || ''
                    },
                    create: {
                        code: String(c.code),
                        name: c.name,
                        phone: String(c.phone || ''),
                        phone2: String(c.phone2 || ''),
                        address: c.address || '',
                        source: 'ADMIN'
                    }
                });
                count++;
            }
        }
        revalidatePath('/admin/customers');
        return { success: true, count };
    } catch (e) {
        return { success: false, error: 'حدث خطأ أثناء الاستيراد' };
    }
}

export async function deleteCustomer(id: string) {
    try {
        await prisma.customer.delete({ where: { id } });
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (e) { 
        return { success: false, error: 'لا يمكن حذف العميل لوجود معاملات سابقة' }; 
    }
}

export async function deleteBulkCustomers(ids: string[]) {
    try {
        const res = await prisma.customer.deleteMany({
            where: {
                id: { in: ids },
                orders: { none: {} },
                payments: { none: {} }
            }
        });
        revalidatePath('/admin/customers');
        return { success: true, deleted: res.count, failed: ids.length - res.count };
    } catch (e) {
        return { success: false, error: 'حدث خطأ في قاعدة البيانات' };
    }
}

export async function deleteAllCustomers() {
    try {
        const totalBefore = await prisma.customer.count();
        const res = await prisma.customer.deleteMany({
            where: {
                orders: { none: {} },
                payments: { none: {} }
            }
        });
        const remaining = totalBefore - res.count;
        revalidatePath('/admin/customers');
        return { success: true, deleted: res.count, failed: remaining };
    } catch (e) { 
        return { success: false, error: 'حدث خطأ غير متوقع', deleted: 0, failed: 0 }; 
    }
}

export async function getAdminCustomers() {
    const custs = await prisma.customer.findMany({ orderBy: { id: 'desc' }, take: 2000 });
    return JSON.parse(JSON.stringify(custs));
}

// ==========================================
// 4. نظام الإشعارات (Notifications)
// ==========================================

export async function getLowStockClosedCount() {
    try {
        const count = await prisma.product.count({
            where: {
                status: 'CLOSED',
                currentStock: { lte: 4 }
            }
        });
        return count;
    } catch (e) {
        return 0;
    }
}

export async function getLowStockClosedItems() {
  try {
    const items = await prisma.product.findMany({
      where: {
        status: "CLOSED",
        currentStock: { lte: 4 },
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        currentStock: true,
        price: true,
        isStockAlertRead: true, 
      },
      orderBy: {
        currentStock: 'asc',
      }
    });
    return items;
  } catch (error) {
    return [];
  }
}

// ==========================================
// 5. إدارة النقدية ودفتر الأستاذ (Cash Management & Ledger)
// ==========================================

export async function getPayments() {
    try {
        // 1. Fetch all standard payments
        const payments = await prisma.payment.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                safe: true,
                targetSafe: true,
                customer: true,
                user: true,
            },
        });

        // 2. Fetch all orders with a deposit (the correct field name is `deposit`)
        const ordersWithDeposits = await prisma.order.findMany({
            where: {
                deposit: { gt: 0 },
            },
            include: {
                customer: true,
                user: true,
                safe: true, // `safeId` exists on the Order model, so we can include the safe
            },
        });

        // 3. Format orders to match the payment structure
        const formattedDeposits = ordersWithDeposits.map(order => ({
            id: `order-dep-${order.id}`, // Virtual ID
            amount: order.deposit, // Use the correct field `deposit`
            type: 'INCOME',
            description: `عربون للطلب رقم #${order.orderNo}`, // Use the correct field `orderNo`
            currency: order.currency,
            createdAt: order.createdAt,
            user: order.user,
            customer: order.customer,
            safe: order.safe,
            isDownPayment: true, // Flag to identify and lock in the UI
            targetSafe: null,
            targetSafeId: null,
            safeId: order.safeId,
            customerId: order.customerId,
            userId: order.userId,
            receiptNo: null, // Deposits from orders don't have a receipt number
        }));

        // 4. Combine and sort all transactions
        const combinedLedger = [...payments, ...formattedDeposits].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const recentLedger = combinedLedger.slice(0, 200);

        return { success: true, data: JSON.parse(JSON.stringify(recentLedger)) };

    } catch (e) {
        console.error("Failed to fetch payments ledger:", e);
        return { success: false, error: 'Failed to fetch payments.' };
    }
}


export async function updatePayment(id: string, data: any) {
    try {
        await prisma.payment.update({
            where: { id },
            data: {
                amount: parseFloat(data.amount),
                description: data.description,
                type: data.type,
                currency: data.currency,
                safeId: data.safeId,
                targetSafeId: data.targetSafeId,
                customerId: data.customerId,
            }
        });
        revalidatePath('/admin/cash-management');
        revalidatePath('/admin/reports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update payment.' };
    }
}

export async function deletePayment(id: string) {
    try {
        await prisma.payment.delete({ where: { id } });
        revalidatePath('/admin/cash-management');
        revalidatePath('/admin/reports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete payment.' };
    }
}
