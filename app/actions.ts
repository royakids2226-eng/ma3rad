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
  const { customerId, items, total, deposit, safeId, currency, notes } = data;

  const productQuantities = new Map<string, number>();
  const allVariants: any[] = [];

  for (const cartItem of items) {
    for (const variant of cartItem.variants) {
      const requestedPieces = variant.quantity * PIECES_PER_UNIT;
      productQuantities.set(variant.productId, (productQuantities.get(variant.productId) || 0) + requestedPieces);
      allVariants.push(variant);
    }
  }

  const productIds = Array.from(productQuantities.keys());

  try {
    // We can't use a transaction here because we need to return data on failure.
    // We will manually handle rollback/compensation if something fails.

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));
    const insufficientStockItems: any[] = [];

    // 1. Validate stock for all items
    for (const productId of productIds) {
      const product = productMap.get(productId);
      const requestedPieces = productQuantities.get(productId)!;

      if (!product) {
        // This is a critical error, so we throw immediately.
        throw new Error(`الصنف بالمعرف ${productId} غير موجود.`);
      }
      if (product.status !== 'OPEN' && product.currentStock < requestedPieces) {
        insufficientStockItems.push({
          productId: product.id,
          modelNo: product.modelNo,
          color: product.color,
          // Return available series, not pieces
          availableStock: Math.floor(product.currentStock / PIECES_PER_UNIT), 
          requestedQty: Math.floor(requestedPieces / PIECES_PER_UNIT),
        });
      }
    }

    // 2. If there are any items with insufficient stock, return them to the client
    if (insufficientStockItems.length > 0) {
      return {
        success: false,
        error: "يوجد أصناف في السلة غير متاحة بالمخزون أو كميتها لا تكفي.",
        insufficientStockItems: insufficientStockItems,
      };
    }

    // 3. If all checks pass, proceed with the transaction
    const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
            data: {
                userId,
                customerId,
                totalAmount: total,
                deposit: deposit || 0,
                currency: currency || 'EGP',
                safeId: deposit > 0 ? safeId : null,
                notes: notes,
            },
        });

        const orderItemsData = allVariants.map(variant => ({
            orderId: order.id,
            productId: variant.productId,
            quantity: variant.quantity,
            price: variant.price,
            discountPercent: variant.discountPercent || 0,
        }));

        await tx.orderItem.createMany({ data: orderItemsData });

        const stockUpdatePromises = productIds.map(productId =>
            tx.product.update({
                where: { id: productId },
                data: { currentStock: { decrement: productQuantities.get(productId) } },
            })
        );

        await Promise.all(stockUpdatePromises);

        return order;
    });

    revalidatePath('/');
    revalidatePath('/admin/products');
    revalidatePath('/admin/notifications');

    return { success: true, data: JSON.parse(JSON.stringify(result)) };

  } catch (error: any) {
    console.error("Error creating order:", error);
    // This will now mostly catch critical errors, not stock issues.
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
    const { items, total, deposit, safeId, currency, notes } = data; // Added notes

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch old items (including product details for error messages)
            const oldItems = await tx.orderItem.findMany({
                where: { orderId },
                include: { product: true } // Include product for error messages and logic
            });

            // 2. Prepare a map of new items for easy lookup
            const newItemsMap = new Map<string, { quantity: number; price: number; discountPercent: number; productId: string }>();
            for (const cartItem of items) {
                for (const variant of cartItem.variants) {
                    const key = variant.productId;
                    if (newItemsMap.has(key)) {
                        const existing = newItemsMap.get(key)!;
                        existing.quantity += variant.quantity;
                    } else {
                        newItemsMap.set(key, {
                            productId: variant.productId,
                            quantity: variant.quantity,
                            price: variant.price,
                            discountPercent: variant.discountPercent || 0,
                        });
                    }
                }
            }

            const oldItemsMap = new Map(oldItems.map(item => [item.productId, item]));

            // 3. Determine items to delete, add, or update
            const itemsToDelete = oldItems.filter(oldItem => !newItemsMap.has(oldItem.productId));
            const itemsToAdd: any[] = [];
            const itemsToUpdate: any[] = [];

            for (const [productId, newItem] of newItemsMap.entries()) {
                if (oldItemsMap.has(productId)) {
                    const oldItem = oldItemsMap.get(productId)!;
                    if (oldItem.quantity !== newItem.quantity || oldItem.price !== newItem.price || oldItem.discountPercent !== newItem.discountPercent) {
                        itemsToUpdate.push({ oldItem, newItem });
                    }
                } else {
                    itemsToAdd.push(newItem);
                }
            }

            // 4. Process deletions
            for (const itemToDelete of itemsToDelete) {
                if (itemToDelete.fulfilledQty > 0) {
                    throw new Error(`لا يمكن حذف الصنف ${itemToDelete.product.modelNo} لأنه تم صرف كميات منه بالفعل.`);
                }
                const piecesToReturn = itemToDelete.quantity * PIECES_PER_UNIT;
                await tx.product.update({
                    where: { id: itemToDelete.productId },
                    data: { currentStock: { increment: piecesToReturn } }
                });
                await tx.orderItem.delete({ where: { id: itemToDelete.id } });
            }

            // 5. Process additions
            for (const itemToAdd of itemsToAdd) {
                const requestedPieces = itemToAdd.quantity * PIECES_PER_UNIT;
                const product = await tx.product.findUnique({ where: { id: itemToAdd.productId } });
                if (!product) throw new Error (`الصنف ${itemToAdd.productId} غير موجود`);
                if (product.status !== 'OPEN' && product.currentStock < requestedPieces) {
                    throw new Error(`عذراً، الكمية نفذت للصنف: ${product.modelNo} - لون: ${product.color}`);
                }
                await tx.product.update({
                    where: { id: itemToAdd.productId },
                    data: { currentStock: { decrement: requestedPieces } }
                });
                await tx.orderItem.create({
                    data: {
                        orderId: orderId,
                        productId: itemToAdd.productId,
                        quantity: itemToAdd.quantity,
                        price: itemToAdd.price,
                        discountPercent: itemToAdd.discountPercent
                    }
                });
            }

            // 6. Process updates
            for (const { oldItem, newItem } of itemsToUpdate) {
                if (newItem.quantity < oldItem.fulfilledQty) {
                    throw new Error(`لا يمكن تخفيض كمية الصنف ${oldItem.product.modelNo} لأقل من الكمية التي تم صرفها (${oldItem.fulfilledQty}).`);
                }
                const quantityDifference = newItem.quantity - oldItem.quantity;
                const stockDifference = quantityDifference * PIECES_PER_UNIT;

                if (stockDifference > 0) {
                    const product = await tx.product.findUnique({ where: { id: newItem.productId } });
                    if (!product) throw new Error (`الصنف ${newItem.productId} غير موجود`);
                    if (product.status !== 'OPEN' && product.currentStock < stockDifference) {
                        throw new Error(`عذراً، الكمية الإضافية للصنف ${product.modelNo} غير متاحة.`);
                    }
                }

                await tx.product.update({
                    where: { id: newItem.productId },
                    data: { currentStock: { decrement: stockDifference } }
                });

                await tx.orderItem.update({
                    where: { id: oldItem.id },
                    data: {
                        quantity: newItem.quantity,
                        price: newItem.price,
                        discountPercent: newItem.discountPercent
                    }
                });
            }

            // 7. Update the order itself
            await tx.order.update({
                where: { id: orderId },
                data: {
                    totalAmount: total,
                    deposit: deposit || 0,
                    currency: currency || 'EGP',
                    safeId: deposit > 0 ? safeId : null,
                    notes: notes
                }
            });
        }, {
            maxWait: 10000,
            timeout: 20000,
        });

        revalidatePath(`/orders/list`);
        revalidatePath(`/orders/${orderId}/edit`);
        revalidatePath('/admin/notifications');
        return { success: true };

    } catch (error: any) {
        console.error("Error updating order:", error);
        return { success: false, error: error.message };
    }
}

export async function getUserOrders(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let whereCondition = {};
    if (user?.role !== 'ADMIN' && user?.role !== 'OWNER' && user?.role !== 'ACCOUNTANT') {
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
