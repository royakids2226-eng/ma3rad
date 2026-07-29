'use server'
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// معامل التحويل (عدد القطع في الدزينة أو الوحدة)
const PIECES_PER_UNIT = 1;

// ==========================================
// 0. إدارة الإعدادات (Settings) - تم النقل هنا
// ==========================================

export async function getSettings() {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  return JSON.parse(JSON.stringify(settings));
}

export async function updateSettings(data: any) {
  try {
    const settings = await prisma.settings.findFirst();
    const settingsId = settings ? settings.id : "new";

    await prisma.settings.upsert({
      where: { id: settingsId },
      update: data,
      create: data,
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "حدث خطأ أثناء تحديث الإعدادات" };
  }
}

// ==========================================
// 1. العملاء (جلب وبحث وتحقق)
// ==========================================

export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      take: 20,
      orderBy: { name: "asc" },
    });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) {
    return [];
  }
}

export async function searchCustomers(term: string) {
  if (!term) return [];
  const normalizedTerm = term.replace(/[أإآ]/g, "ا");
  try {
    const customers = await prisma.$queryRaw`
      SELECT id, name, phone, "phone2", address, source 
      FROM "Customer"
      WHERE 
        TRANSLATE(name, 'أإآ', 'ااا') LIKE ${`%${normalizedTerm}%`}
        OR phone LIKE ${`%${term}%`}
        OR "phone2" LIKE ${`%${term}%`}
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
        OR: [{ phone: { contains: phone } }, { phone2: { contains: phone } }],
      },
      select: { name: true, phone: true, phone2: true },
    });

    if (existingCustomer) {
      return {
        exists: true,
        name: existingCustomer.name,
        details: `الرقم مسجل باسم: ${existingCustomer.name}`,
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
    const safes = await prisma.safe.findMany({ orderBy: { name: "asc" } });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) {
    return [];
  }
}

// دالة لجلب كل المنتجات للبحث المحلي في الواجهة الأمامية
export async function getProductsForSearch() {
  try {
    const products = await prisma.product.findMany({
      include: {
        // نجلب مبيعات كل صنف لنحسب الرصيد الفعلي حالاً
        orderItems: {
          select: { quantity: true },
        },
      },
      orderBy: { modelNo: "asc" },
    });

    const logicalProducts = products.map((p) => {
      const initialPieces = p.stockQty || 0;

      // حساب إجمالي القطع المباعة
      const totalSoldPieces = p.orderItems.reduce((acc, item) => {
        return acc + (item.quantity || 0);
      }, 0);

      // الرصيد الفعلي بالقطع
      const actualCurrentStockPieces = initialPieces - totalSoldPieces;

      return {
        id: p.id,
        modelNo: p.modelNo,
        color: p.color,
        price: p.price,
        // نرسل الرصيد المحسوب بدلاً من المخزن في قاعدة البيانات
        currentStock: actualCurrentStockPieces,
        status: p.status,
        description: p.description,
        discount: p.discount,
      };
    });

    return JSON.parse(JSON.stringify(logicalProducts));
  } catch (error) {
    console.error("Error fetching products for search:", error);
    return [];
  }
}

export async function searchProducts(term: string) {
  if (!term || term.length < 2) return [];
  try {
    const products = await prisma.product.findMany({
      where: { modelNo: { contains: term, mode: "insensitive" } },
      orderBy: { modelNo: "asc" },
    });
    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    return [];
  }
}

export async function getAdminStockAlerts() {
  try {
    const lowStockItems = await prisma.product.findMany({
      where: {
        status: "CLOSED",
        currentStock: {
          lte: 4,
        },
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        currentStock: true,
        description: true,
      },
      orderBy: {
        currentStock: "asc",
      },
    });

    return {
      count: lowStockItems.length,
      items: JSON.parse(JSON.stringify(lowStockItems)),
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
  const { customerId, items, total, deposit, depositSplits, voucherAmount, currency, notes, createdAt } = data;

  // التحقق من الـ splits لو فيه عربون أو مرتجع
  if (deposit !== 0) {
    if (!depositSplits || depositSplits.length === 0) {
      return { success: false, error: 'عند وجود حركة نقدية، يجب تحديد الخزنة.' };
    }
    const splitsTotal = depositSplits.reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);
    if (Math.abs(splitsTotal - deposit) > 0.01) {
      return { success: false, error: 'مجموع تقسيمات المبلغ لا يساوي القيمة الإجمالية للحركة النقدية.' };
    }
  }

  const productQuantities = new Map<string, number>();
  const allVariants: any[] = [];

  for (const cartItem of items) {
    for (const variant of cartItem.variants) {
      const requestedPieces = variant.quantity * PIECES_PER_UNIT;
      productQuantities.set(
        variant.productId,
        (productQuantities.get(variant.productId) || 0) + requestedPieces,
      );
      allVariants.push(variant);
    }
  }

  const productIds = Array.from(productQuantities.keys());

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const insufficientStockItems: any[] = [];

    for (const productId of productIds) {
      const product = productMap.get(productId);
      const requestedPieces = productQuantities.get(productId)!;

      if (!product) {
        throw new Error(`الصنف بالمعرف ${productId} غير موجود.`);
      }
      if (product.status !== "OPEN" && product.currentStock < requestedPieces) {
        insufficientStockItems.push({
          productId: product.id,
          modelNo: product.modelNo,
          color: product.color,
          availableStock: Math.floor(product.currentStock / PIECES_PER_UNIT),
          requestedQty: Math.floor(requestedPieces / PIECES_PER_UNIT),
        });
      }
    }

    if (insufficientStockItems.length > 0) {
      return {
        success: false,
        error: "يوجد أصناف في السلة غير متاحة بالمخزون أو كميتها لا تكفي.",
        insufficientStockItems: insufficientStockItems,
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            userId,
            customerId,
            totalAmount: total,
            deposit: deposit || 0,
            currency: currency || "EGP",
            notes: notes,
            safeId: null, // تم إزالة المنطق الخاطئ من هنا
            createdAt: createdAt ? new Date(createdAt) : new Date(),
          },
          include: { customer: true },
        });

        const orderItemsData = allVariants.map((variant) => {
            const discount = variant.discountPercent || 0;
            // Reverse calculate the base price from the final price sent by the client
            const basePrice = (discount > 0 && discount < 100)
              ? variant.price / (1 - discount / 100)
              : variant.price;
      
            return {
              orderId: order.id,
              productId: variant.productId,
              quantity: variant.quantity,
              price: basePrice, // Save the correct base price
              discountPercent: discount,
            };
        });

        await tx.orderItem.createMany({ data: orderItemsData });

        // ✅ تحديث المخزون مع دعم الكميات السالبة (مرتجع)
        for (const item of items) {
          for (const variant of item.variants) {
            const qty = variant.quantity;
            
            if (qty > 0) {
              // بيع عادي - خصم من المخزون
              await tx.product.update({
                where: { id: variant.productId },
                data: {
                  currentStock: { decrement: qty },
                },
              });
            } else if (qty < 0) {
              // مرتجع - إضافة للمخزون
              await tx.product.update({
                where: { id: variant.productId },
                data: {
                  currentStock: { increment: Math.abs(qty) },
                },
              });
            }
            // لو qty === 0، لا تفعل شيئاً
          }
        }

        // إنشاء سندات الدفع/الاسترداد لكل split
        if (deposit !== 0 && depositSplits && depositSplits.length > 0) {
          for (const split of depositSplits) {
            const splitAmount = parseFloat(split.amount) || 0;
            if (splitAmount === 0) continue;

            if (splitAmount > 0) {
              await tx.payment.create({
                data: {
                  type: 'PAYMENT_COLLECTION',
                  amount: splitAmount,
                  currency: currency || 'EGP',
                  safeId: split.safeId,
                  userId: userId,
                  customerId: customerId,
                  description: `تحصيل دفعة للأوردر رقم #${order.orderNo} للعميل: ${order.customer.name}`,
                },
              });
            } else { // splitAmount < 0
              await tx.payment.create({
                data: {
                  type: 'OUT',
                  amount: Math.abs(splitAmount),
                  currency: currency || 'EGP',
                  safeId: split.safeId,
                  userId: userId,
                  customerId: customerId,
                  description: `مرتجع نقدي للأوردر رقم #${order.orderNo} للعميل: ${order.customer.name}`,
                },
              });
            }
          }
        }

        // إنشاء سند القسيمة (ظاهري فقط - للحسابات)
        if (voucherAmount > 0) {
          await tx.payment.create({
            data: {
              type: 'VOUCHER',
              amount: parseFloat(voucherAmount),
              currency: currency || 'EGP',
              safeId: null,
              userId: userId,
              customerId: customerId,
              description: `قسيمة مشتريات للأوردر رقم #${order.orderNo} - خصم ظاهري`,
            },
          });
        }

        return order;
      },
      {
        maxWait: 15000, // Wait 15s for the transaction to start
        timeout: 90000, // Allow 90s for the whole transaction to complete for large orders
      },
    );

    revalidatePath("/");
    revalidatePath("/admin/products");
    revalidatePath("/admin/notifications");
    revalidatePath("/orders/list");
    revalidatePath("/admin/cash-management"); // Revalidate the cash management page

    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("Error creating order:", error);
    return {
      success: false,
      error: error.message || "فشل إنشاء الطلب بسبب خطأ غير متوقع.",
    };
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
            payments: { orderBy: { createdAt: "desc" } },
          },
        },
        user: true,
        items: { include: { product: true } },
      },
    });
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    return null;
  }
}

export async function deleteOrder(orderId: string) {
  try {
    await prisma.$transaction(
      async (tx) => {
        // Step 1: Check for fulfilled items
        const fulfilledItems = await tx.orderItem.findMany({
          where: { orderId: orderId, fulfilledQty: { gt: 0 } },
          include: { product: true },
        });

        if (fulfilledItems.length > 0) {
          const itemDetails = fulfilledItems
            .map(
              (item) =>
                `${item.product.modelNo} (الكمية المصروفة: ${item.fulfilledQty})`,
            )
            .join(", ");
          throw new Error(
            `لا يمكن حذف الأوردر لوجود أصناف تم صرفها بالفعل: ${itemDetails}`,
          );
        }

        // Step 2: Get order details and items to restore stock
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { orderNo: true, deposit: true, items: true },
        });

        if (!order) {
          throw new Error("لم يتم العثور على الطلب.");
        }

        // Step 3: If a deposit exists, delete the corresponding payment entry
        if (order.deposit && order.deposit > 0) {
          await tx.payment.deleteMany({
            where: {
              description: { contains: `للأوردر رقم #${order.orderNo}` },
              type: "PAYMENT_COLLECTION",
            },
          });
        }

        // Step 4: Efficiently restore stock for all items in the order
        if (order.items.length > 0) {
          const caseStatement = order.items
            .map(
              (item) =>
                `WHEN id = '${item.productId}' THEN "currentStock" + ${item.quantity * PIECES_PER_UNIT}`,
            )
            .join(" ");

          const idList = order.items
            .map((item) => `'${item.productId}'`)
            .join(",");

          const query = `UPDATE "Product" SET "currentStock" = CASE ${caseStatement} END WHERE id IN (${idList})`;

          await tx.$executeRawUnsafe(query);
        }

        // Step 4.5: Delete dependent records before deleting order items
        const orderItemIds = order.items.map((item) => item.id);

        // Delete associated ReturnOrders, which will cascade to ReturnItems,
        // resolving constraints on both Order and OrderItem.
        await tx.returnOrder.deleteMany({
            where: {
                OR: [
                    { originalOrderId: orderId },
                    { newOrderId: orderId },
                ]
            }
        });

        if (orderItemIds.length > 0) {
          // Delete any fulfillment logs associated with the order items
          await tx.fulfillmentLog.deleteMany({
            where: {
              orderItemId: { in: orderItemIds },
            },
          });
        }

        // Step 5: Delete order items and the order itself
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
      },
      {
        maxWait: 15000,
        timeout: 90000, // Increased timeout for large deletions
      },
    );

    revalidatePath("/orders/list");
    revalidatePath("/admin/notifications");
    revalidatePath("/admin/products");
    revalidatePath("/admin/cash-management"); // Ensure ledger is updated
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting order:", error);
    return { success: false, error: error.message || "فشل حذف الطلب" };
  }
}

export async function updateOrder(orderId: string, data: any) {
  const { customerId, items, total, deposit, depositSplits, voucherAmount, currency, notes } = data;
  const newDepositAmount = parseFloat(deposit) || 0;
  const newVoucherAmount = parseFloat(voucherAmount) || 0;

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!existingOrder) {
      throw new Error("لم يتم العثور على الطلب المراد تحديثه.");
    }
    
    // Validate deposit splits
    if (newDepositAmount !== 0) {
        if (!depositSplits || depositSplits.length === 0) {
             throw new Error('عند وجود حركة نقدية، يجب تحديد الخزنة.');
        }
        const splitsTotal = depositSplits.reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);
        if (Math.abs(splitsTotal - newDepositAmount) > 0.01) {
            throw new Error('مجموع تقسيمات المبلغ لا يساوي القيمة الإجمالية للحركة النقدية.');
        }
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Fetch old items (including product details for error messages)
        const oldItems = await tx.orderItem.findMany({
          where: { orderId },
          include: { product: true },
        });

        // 2. Prepare a map of new items for easy lookup
        const newItemsMap = new Map<string, { quantity: number; price: number; discountPercent: number; productId: string; }>();
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

        const oldItemsMap = new Map(
          oldItems.map((item) => [item.productId, item]),
        );

        // 3. Determine items to delete, add, or update
        const itemsToDelete = oldItems.filter(
          (oldItem) => !newItemsMap.has(oldItem.productId),
        );
        const itemsToAdd: any[] = [];
        const itemsToUpdate: any[] = [];

        for (const [productId, newItem] of newItemsMap.entries()) {
          if (oldItemsMap.has(productId)) {
            const oldItem = oldItemsMap.get(productId)!;
            const newDiscount = newItem.discountPercent || 0;
            const newBasePrice = (newDiscount > 0 && newDiscount < 100) ? newItem.price / (1 - newDiscount / 100) : newItem.price;

            if (
              oldItem.quantity !== newItem.quantity ||
              Math.abs(oldItem.price - newBasePrice) > 0.01 || 
              oldItem.discountPercent !== newDiscount
            ) {
              itemsToUpdate.push({ oldItem, newItem });
            }
          } else {
            itemsToAdd.push(newItem);
          }
        }

        // 4. Process deletions
        for (const itemToDelete of itemsToDelete) {
          if (itemToDelete.fulfilledQty > 0) {
            throw new Error(
              `لا يمكن حذف الصنف ${itemToDelete.product.modelNo} لأنه تم صرف كميات منه بالفعل.`,
            );
          }
          const piecesToReturn = itemToDelete.quantity * PIECES_PER_UNIT;
          await tx.product.update({
            where: { id: itemToDelete.productId },
            data: { currentStock: { increment: piecesToReturn } },
          });
          await tx.orderItem.delete({ where: { id: itemToDelete.id } });
        }

        // 5. Process additions
        for (const itemToAdd of itemsToAdd) {
          const requestedPieces = itemToAdd.quantity * PIECES_PER_UNIT;
          const product = await tx.product.findUnique({
            where: { id: itemToAdd.productId },
          });
          if (!product)
            throw new Error(`الصنف ${itemToAdd.productId} غير موجود`);
          if (
            product.status !== "OPEN" &&
            product.currentStock < requestedPieces
          ) {
            throw new Error(
              `عذراً، الكمية نفذت للصنف: ${product.modelNo} - لون: ${product.color}`,
            );
          }
          await tx.product.update({
            where: { id: itemToAdd.productId },
            data: { currentStock: { decrement: requestedPieces } },
          });
          
          const discount = itemToAdd.discountPercent || 0;
          const basePrice = (discount > 0 && discount < 100)
              ? itemToAdd.price / (1 - discount / 100)
              : itemToAdd.price;

          await tx.orderItem.create({
            data: {
              orderId: orderId,
              productId: itemToAdd.productId,
              quantity: itemToAdd.quantity,
              price: basePrice,
              discountPercent: discount,
            },
          });
        }

        // 6. Process updates
        for (const { oldItem, newItem } of itemsToUpdate) {
          if (newItem.quantity < oldItem.fulfilledQty) {
            throw new Error(
              `لا يمكن تخفيض كمية الصنف ${oldItem.product.modelNo} لأقل من الكمية التي تم صرفها (${oldItem.fulfilledQty}).`,
            );
          }
          const quantityDifference = newItem.quantity - oldItem.quantity;
          const stockDifference = quantityDifference * PIECES_PER_UNIT;

          if (stockDifference > 0) {
            const product = await tx.product.findUnique({
              where: { id: newItem.productId },
            });
            if (!product)
              throw new Error(`الصنف ${newItem.productId} غير موجود`);
            if (
              product.status !== "OPEN" &&
              product.currentStock < stockDifference
            ) {
              throw new Error(
                `عذراً، الكمية الإضافية للصنف ${product.modelNo} غير متاحة.`,
              );
            }
          }

          await tx.product.update({
            where: { id: newItem.productId },
            data: { currentStock: { decrement: stockDifference } },
          });

          const discount = newItem.discountPercent || 0;
          const basePrice = (discount > 0 && discount < 100)
              ? newItem.price / (1 - discount / 100)
              : newItem.price;

          await tx.orderItem.update({
            where: { id: oldItem.id },
            data: {
              quantity: newItem.quantity,
              price: basePrice,
              discountPercent: discount,
            },
          });
        }

        // 7. Handle Financial Records (Payments & Vouchers)
        const newCustomer = await tx.customer.findUnique({ where: { id: customerId } });
        const customerName = newCustomer?.name || existingOrder.customer.name;

        // 7a. Deposit Splits (Payments)
        const paymentDescriptionFragment = `للأوردر رقم #${existingOrder.orderNo}`;
        await tx.payment.deleteMany({
            where: {
                description: { contains: paymentDescriptionFragment },
                type: 'PAYMENT_COLLECTION'
            }
        });

        if (newDepositAmount !== 0 && depositSplits && depositSplits.length > 0) {
            for (const split of depositSplits) {
                const splitAmount = parseFloat(split.amount) || 0;
                if (splitAmount === 0) continue;

                const type = splitAmount > 0 ? 'PAYMENT_COLLECTION' : 'OUT';
                const description = `${splitAmount > 0 ? 'تحصيل دفعة' : 'مرتجع نقدي'} للأوردر رقم #${existingOrder.orderNo} للعميل: ${customerName}`;
                
                await tx.payment.create({
                    data: {
                        type,
                        amount: Math.abs(splitAmount),
                        currency: currency || 'EGP',
                        safeId: split.safeId,
                        userId: existingOrder.userId,
                        customerId,
                        description
                    }
                });
            }
        }

        // 7b. Voucher Handling
        const voucherDescription = `قسيمة مشتريات للأوردر رقم #${existingOrder.orderNo} - خصم ظاهري`;
        const existingVoucher = await tx.payment.findFirst({
            where: {
                description: voucherDescription,
                type: 'VOUCHER'
            }
        });

        if (newVoucherAmount > 0) {
            if (existingVoucher) {
                await tx.payment.update({
                    where: { id: existingVoucher.id },
                    data: { amount: newVoucherAmount, customerId } 
                });
            } else {
                await tx.payment.create({
                    data: {
                        type: 'VOUCHER',
                        amount: newVoucherAmount,
                        currency: currency || 'EGP',
                        safeId: null,
                        userId: existingOrder.userId,
                        customerId,
                        description: voucherDescription
                    }
                });
            }
        } else if (existingVoucher) {
            await tx.payment.delete({ where: { id: existingVoucher.id } });
        }
        
        // 8. Update the order record itself.
        await tx.order.update({
          where: { id: orderId },
          data: {
            customerId: customerId,
            totalAmount: total,
            deposit: newDepositAmount,
            currency: currency || "EGP",
            safeId: null, // This is deprecated, deposit splits are used instead
            notes: notes,
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    );

    revalidatePath(`/orders/list`);
    revalidatePath(`/orders/${orderId}/edit`);
    revalidatePath("/admin/notifications");
    revalidatePath("/admin/cash-management");
    revalidatePath(`/admin/reports/customer/${customerId}`);
    
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
    if (
      user?.role !== "ADMIN" &&
      user?.role !== "OWNER" &&
      user?.role !== "ACCOUNTANT"
    ) {
      whereCondition = { userId: userId };
    }
    // Using `include` is the correct and robust way to get all scalar fields (like orderNo)
    // and the specified relations.
    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        customer: true,
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    return { orders: JSON.parse(JSON.stringify(orders)), userRole: user?.role };
  } catch (error) {
    console.error("Error in getUserOrders:", error);
    return { orders: [], userRole: "EMPLOYEE" };
  }
}

// ==========================================
// 4. إدارة النقدية والموظفين
// ==========================================

export async function createPayment(data: any, userId: string) {
  // ✅ تعديل: استقبال paymentDate
  const { type, amount, currency, safeId, targetSafeId, description, customerId, vendorId, isExpense, paymentDate } = data;

  if (!amount || amount <= 0) {
    return { success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
  }

  if (!safeId) {
    return { success: false, error: 'يجب اختيار الخزنة' };
  }

  if (type === 'IN' && !customerId) {
    return { success: false, error: 'يجب اختيار العميل' };
  }

  if (type === 'OUT' && !customerId && !vendorId && !isExpense) {
    return { success: false, error: 'يجب تحديد الجهة (مورد أو مصروفات)' };
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        type,
        amount: parseFloat(amount),
        currency: currency || 'EGP',
        safeId,
        targetSafeId: targetSafeId || null,
        description: description || null,
        customerId: customerId || null,
        vendorId: vendorId || null,
        userId,
        // ✅ تعديل: استخدام التاريخ المخصص أو الحالي
        createdAt: paymentDate ? new Date(paymentDate + 'T12:00:00') : new Date(),
      },
    });

    return { success: true, payment };
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return { success: false, error: error.message };
  }
}

export async function registerEmployee(data: any) {
  try {
    const { code, name, password } = data;
    const existingUser = await prisma.user.findUnique({ where: { code } });
    if (existingUser)
      return { success: false, error: "كود الموظف مستخدم بالفعل" };

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { code, name, password: hashedPassword, role: "EMPLOYEE" },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: "حدث خطأ أثناء التسجيل" };
  }
}

export async function getCurrentUser(userId: string) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    return null;
  }
}

// ==========================================
// 5. نظام المرتجعات
// ==========================================

export async function getReturnOrders() {
  try {
    const returns = await prisma.returnOrder.findMany({
      include: {
        originalOrder: { include: { customer: true } },
        newOrder: true,
        user: true,
        safe: true,
        items: {
          include: {
            product: true,
            exchangedProduct: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return JSON.parse(JSON.stringify(returns));
  } catch (error) {
    console.error("Error fetching returns:", error);
    return [];
  }
}

export async function getReturnById(returnId: string) {
  try {
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: returnId },
      include: {
        originalOrder: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
        newOrder: {
          include: { items: { include: { product: true } } },
        },
        user: true,
        safe: true,
        items: {
          include: {
            product: true,
            exchangedProduct: true,
          },
        },
      },
    });
    return JSON.parse(JSON.stringify(returnOrder));
  } catch (error) {
    console.error("Error fetching return:", error);
    return null;
  }
}

export async function createReturnOrder(data: any, userId: string) {
  const {
    originalOrderId,
    type,
    reason,
    items,
    exchangeItems, // ✅ نجيبه من البيانات
    totalRefund,
    depositRefunded,
    exchangeAmount,
    refundMethod,
    safeId,
    notes,
  } = data;

  if (!userId) {
    return { success: false, error: "المستخدم غير مسجل الدخول" };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. التحقق من الأوردر الأصلي
        const originalOrder = await tx.order.findUnique({
          where: { id: originalOrderId },
          include: { items: true, customer: true },
        });

        if (!originalOrder) {
          throw new Error("الأوردر الأصلي غير موجود");
        }

        // 2. التحقق من الأصناف المرتجعة
        for (const item of items) {
          const orderItem = await tx.orderItem.findUnique({
            where: { id: item.orderItemId },
          });
          if (!orderItem) {
            throw new Error(`الصنف غير موجود في الأوردر`);
          }
          if (item.quantity > orderItem.quantity) {
            throw new Error("الكمية المرتجعة أكبر من الكمية الأصلية");
          }
        }

        // 3. لو استبدال - إنشاء الأوردر الجديد أولاً
        let newOrderId = null;

        if (type === "EXCHANGE" && exchangeItems && exchangeItems.length > 0) {
          // ✅ نستخدم exchangeItems مباشرة
          const allExchangeProducts = new Map<
            string,
            {
              quantity: number;
              price: number;
              productId: string;
            }
          >();

          exchangeItems.forEach((item: any) => {
            const key = item.productId;
            if (allExchangeProducts.has(key)) {
              const existing = allExchangeProducts.get(key)!;
              existing.quantity += item.quantity;
            } else {
              allExchangeProducts.set(key, {
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              });
            }
          });

          // حساب الإجمالي
          let newOrderTotal = 0;
          allExchangeProducts.forEach((item) => {
            newOrderTotal += item.quantity * item.price;
          });

          // إنشاء الأوردر الجديد
          const newOrder = await tx.order.create({
            data: {
              userId,
              customerId: originalOrder.customerId,
              totalAmount: newOrderTotal,
              deposit: 0,
              currency: originalOrder.currency || "EGP",
              safeId: null,
              notes: `أوردر استبدال من المرتجع - أوردر أصلي #${originalOrder.orderNo}`,
            },
          });

          // إنشاء عناصر الأوردر الجديد
          const exchangeItemsData = Array.from(
            allExchangeProducts.values(),
          ).map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discountPercent: 0,
          }));

          await tx.orderItem.createMany({ data: exchangeItemsData });

          // خصم المخزون للأصناف الجديدة
          for (const item of exchangeItemsData) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { decrement: item.quantity } },
            });
          }

          newOrderId = newOrder.id;
        }

        // 4. إنشاء المرتجع
        const returnOrder = await tx.returnOrder.create({
          data: {
            originalOrderId,
            type,
            reason,
            totalRefund: type === "EXCHANGE" ? 0 : totalRefund || 0,
            depositRefunded: depositRefunded || 0,
            exchangeAmount: type === "EXCHANGE" ? exchangeAmount || 0 : 0,
            refundMethod:
              type === "EXCHANGE" ? "CREDIT" : refundMethod || "CASH",
            safeId:
              type !== "EXCHANGE" && refundMethod === "CASH" ? safeId : null,
            newOrderId: newOrderId,
            status: "COMPLETED",
            userId,
            notes,
            items: {
              create: items.map((item: any) => ({
                orderItemId: item.orderItemId,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                refundAmount: item.refundAmount,
                exchangedProductId: null,
                exchangedQty: 0,
                exchangedPrice: 0,
              })),
            },
          },
        });

        // 5. إرجاع المخزون للأصناف المرتجعة
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
        }

        // 6. معالجة الاسترداد النقدي (للمرتجع العادي فقط)
        if (type !== 'EXCHANGE' && refundMethod === 'CASH' && totalRefund > 0 && safeId) {
            await tx.payment.create({
                data: {
                type: 'OUT',
                amount: totalRefund,
                currency: originalOrder.currency || 'EGP',
                safeId,
                userId,
                customerId: originalOrder.customerId,
                description: `استرداد مرتجع #${returnOrder.returnNo} للأوردر #${originalOrder.orderNo}`,
                },
            });
        }

        // 7. ✅ معالجة فرق الاستبدال (جديد)
        if (type === 'EXCHANGE' && exchangeAmount !== 0 && safeId) {
            if (exchangeAmount > 0) {
                // العميل يدفع الفرق → سند قبض
                await tx.payment.create({
                data: {
                    type: 'IN',
                    amount: exchangeAmount,
                    currency: originalOrder.currency || 'EGP',
                    safeId,
                    userId,
                    customerId: originalOrder.customerId,
                    description: `فرق استبدال مرتجع #${returnOrder.returnNo} - أوردر #${originalOrder.orderNo}`,
                },
                });
            } else {
                // العميل يسترد الفرق → سند صرف
                await tx.payment.create({
                data: {
                    type: 'OUT',
                    amount: Math.abs(exchangeAmount),
                    currency: originalOrder.currency || 'EGP',
                    safeId,
                    userId,
                    customerId: originalOrder.customerId,
                    description: `استرداد فرق استبدال مرتجع #${returnOrder.returnNo} - أوردر #${originalOrder.orderNo}`,
                },
                });
            }
        }

        // 7. لو مرتجع كامل، تحديث ملاحظات الأوردر الأصلي
        if (type === "FULL") {
          await tx.order.update({
            where: { id: originalOrderId },
            data: {
              notes: `${originalOrder.notes || ""}\n[مرتجع كامل #${returnOrder.returnNo}]`,
            },
          });
        }

        return returnOrder;
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    );

    revalidatePath("/orders/list");
    revalidatePath("/admin/returns");
    revalidatePath("/admin/products");
    revalidatePath("/admin/cash-management");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(result)),
    };
  } catch (error: any) {
    console.error("Error creating return:", error);
    return {
      success: false,
      error: error.message || "فشل إنشاء المرتجع",
    };
  }
}

export async function cancelReturnOrder(returnId: string) {
  try {
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: returnId },
      include: { items: true },
    });

    if (!returnOrder) {
      return { success: false, error: "المرتجع غير موجود" };
    }

    if (returnOrder.status === "CANCELLED") {
      return { success: false, error: "المرتجع ملغي بالفعل" };
    }

    await prisma.$transaction(async (tx) => {
      // عكس إرجاع المخزون
      for (const item of returnOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: item.quantity },
          },
        });

        // لو استبدال، عكس خصم المخزون
        if (item.exchangedProductId && item.exchangedQty > 0) {
          await tx.product.update({
            where: { id: item.exchangedProductId },
            data: {
              currentStock: { increment: item.exchangedQty },
            },
          });
        }
      }

      // إلغاء سند الاسترداد
      if (returnOrder.refundMethod === "CASH" && returnOrder.totalRefund > 0) {
        await tx.payment.deleteMany({
          where: {
            description: { contains: `استرداد مرتجع #${returnOrder.returnNo}` },
            type: "OUT",
          },
        });
      }

      // تحديث حالة المرتجع
      await tx.returnOrder.update({
        where: { id: returnId },
        data: { status: "CANCELLED" },
      });
    });

    revalidatePath("/orders/list");
    revalidatePath("/admin/returns");
    revalidatePath("/admin/products");
    revalidatePath("/admin/cash-management");

    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling return:", error);
    return {
      success: false,
      error: error.message || "فشل إلغاء المرتجع",
    };
  }
}

export async function updateReturnOrder(returnId: string, data: { reason?: string; notes?: string; items?: any[] }) {
    try {
        const { reason, notes, items: newItems } = data;

        if (!returnId) {
            return { success: false, error: "لم يتم تحديد المرتجع" };
        }

        return await prisma.$transaction(async (tx) => {
            // Step 1: Get the current state of the return order from DB
            const returnOrder = await tx.returnOrder.findUnique({
                where: { id: returnId },
                include: { 
                    items: { include: { product: true } }, 
                    originalOrder: true 
                },
            });

            if (!returnOrder) throw new Error("لم يتم العثور على المرتجع.");
            if (returnOrder.status === 'CANCELLED') throw new Error("لا يمكن تعديل مرتجع ملغي.");
            if (returnOrder.type === 'EXCHANGE') throw new Error("تعديل مرتجعات الاستبدال غير مدعوم حالياً.");

            const oldItemsMap = new Map(returnOrder.items.map(item => [item.id, item]));
            const newItemsFromClient = newItems || [];
            let finalTotalRefund = 0;

            // Step 2: Handle Deletions
            const newItemIds = new Set(newItemsFromClient.map(i => i.id).filter(id => id && !id.startsWith('new-')));
            const itemsToDelete = returnOrder.items.filter(oldItem => !newItemIds.has(oldItem.id));

            for (const item of itemsToDelete) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { decrement: item.quantity } },
                });
                await tx.returnItem.delete({ where: { id: item.id } });
            }

            // Step 3: Handle Additions and Updates
            for (const newItem of newItemsFromClient) {
                const originalOrderItem = await tx.orderItem.findUnique({ 
                    where: { id: newItem.orderItemId },
                    include: { product: true }
                });

                if (!originalOrderItem) throw new Error(`الصنف الأصلي بالمعرف ${newItem.orderItemId} غير موجود في الفاتورة الأصلية.`);
                if (newItem.quantity > originalOrderItem.quantity) {
                    throw new Error(`كمية الصنف ${originalOrderItem.product.modelNo} تتجاوز الكمية المشتراة (${originalOrderItem.quantity}).`);
                }
                
                const refundAmountForItem = newItem.quantity * originalOrderItem.price;

                if (newItem.id && !newItem.id.startsWith('new-')) { // UPDATE existing item
                    const oldItem = oldItemsMap.get(newItem.id);
                    if (!oldItem) throw new Error(`الصنف المراد تحديثه ${newItem.id} غير موجود.`);

                    const quantityDifference = newItem.quantity - oldItem.quantity;
                    
                    if (quantityDifference !== 0) {
                        await tx.product.update({
                            where: { id: oldItem.productId },
                            data: { currentStock: { increment: quantityDifference } },
                        });
                    }
                    
                    await tx.returnItem.update({ 
                        where: { id: oldItem.id },
                        data: { 
                            quantity: newItem.quantity, 
                            refundAmount: refundAmountForItem
                        }
                    });

                } else { // ADD new item to the return
                    await tx.product.update({
                        where: { id: originalOrderItem.productId },
                        data: { currentStock: { increment: newItem.quantity } },
                    });

                    await tx.returnItem.create({
                        data: {
                            returnOrderId: returnId,
                            orderItemId: newItem.orderItemId,
                            productId: originalOrderItem.productId,
                            quantity: newItem.quantity,
                            unitPrice: originalOrderItem.price,
                            refundAmount: refundAmountForItem,
                        }
                    });
                }
                finalTotalRefund += refundAmountForItem;
            }

            // Step 4: Update the parent ReturnOrder with new total, reason, and notes
            await tx.returnOrder.update({
                where: { id: returnId },
                data: {
                    reason: reason,
                    notes: notes,
                    totalRefund: finalTotalRefund,
                },
            });

            // Step 5: Create, Update, or Delete the associated Cash Payment
            const paymentDescription = `استرداد مرتجع #${returnOrder.returnNo} للأوردر #${returnOrder.originalOrder.orderNo}`;
            const existingPayment = await tx.payment.findFirst({ where: { description: paymentDescription, type: 'OUT' } });

            if (finalTotalRefund > 0) {
                 if (existingPayment) {
                    await tx.payment.update({ 
                        where: { id: existingPayment.id },
                        data: { amount: finalTotalRefund }
                    });
                 } else if (returnOrder.safeId) { 
                      await tx.payment.create({
                        data: {
                            type: 'OUT',
                            amount: finalTotalRefund,
                            currency: returnOrder.originalOrder.currency || 'EGP',
                            safeId: returnOrder.safeId,
                            userId: returnOrder.userId,
                            customerId: returnOrder.originalOrder.customerId,
                            description: paymentDescription,
                        },
                    });
                 }
            } else if (existingPayment) {
                await tx.payment.delete({ where: { id: existingPayment.id } });
            }

            return { success: true };
        });

    } catch (error: any) {
        console.error("Error updating return order:", error);
        return { success: false, error: error.message || "فشل تحديث المرتجع" };
    } finally {
        revalidatePath(`/admin/returns`);
        revalidatePath(`/admin/returns/${returnId}/edit`);
        revalidatePath(`/admin/products`);
        revalidatePath(`/admin/cash-management`);
    }
}

// ==========================================
// 6. تقرير دفتر الأستاذ للعميل
// ==========================================

export async function getCustomerLedger(customerId: string) {
  if (!customerId) return { success: false, error: 'العميل غير موجود' };

  try {
    // 1. جلب بيانات العميل
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return { success: false, error: 'العميل غير موجود' };
    }

    // 2. جلب كل الأوردرات
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: {
        items: {
          include: { product: true },
        },
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // ✅ 3. جلب كل المرتجعات (كامل - جزئي - استبدال)
    const returns = await prisma.returnOrder.findMany({
      where: {
        originalOrder: {
          customerId: customerId  // ✅ نجيب المرتجعات لكل أوردرات العميل
        }
      },
      include: {
        originalOrder: true,
        newOrder: true,
        items: {
          include: {
            product: true,
            exchangedProduct: true,
          },
        },
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. جلب كل حركات النقدية
    const payments = await prisma.payment.findMany({
      where: { customerId },
      include: {
        safe: true,
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 5. تجميع كل الحركات في قائمة واحدة مرتبة بالتاريخ
    const transactions: any[] = [];

    // إضافة الأوردرات
    orders.forEach(order => {
      transactions.push({
        type: 'ORDER',
        date: order.createdAt,
        reference: `أوردر #${order.orderNo}`,
        description: `أوردر مبيعات - ${order.items.length} صنف`,
        debit: order.totalAmount,
        credit: 0,
        orderId: order.id,
        details: order.items.map(item => ({
          modelNo: item.product.modelNo,
          color: item.product.color,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        })),
        user: order.user?.name || 'غير معروف',
      });
    });

    // إضافة المرتجعات
    returns.forEach(ret => {
      const typeLabel = ret.type === 'FULL' ? 'مرتجع كامل' : 
                       ret.type === 'PARTIAL' ? 'مرتجع جزئي' : 'استبدال';
      
      const totalReturnValue = ret.items.reduce((sum, item) => sum + item.refundAmount, 0);

      transactions.push({
        type: 'RETURN',
        date: ret.createdAt,
        reference: `مرتجع #${ret.returnNo}`,
        description: `${typeLabel} - أوردر #${ret.originalOrder.orderNo}`,
        debit: 0,
        credit: totalReturnValue,
        returnId: ret.id,
        details: ret.items.map(item => ({
          modelNo: item.product.modelNo,
          color: item.product.color,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.refundAmount,
          exchangedProduct: item.exchangedProduct ? {
            modelNo: item.exchangedProduct.modelNo,
            color: item.exchangedProduct.color,
            quantity: item.exchangedQty,
            price: item.exchangedPrice,
          } : null,
        })),
        user: ret.user?.name || 'غير معروف',
      });
    });

    // إضافة حركات النقدية
    payments.forEach(payment => {
      let debit = 0;
      let credit = 0;
      let reference = '';

      if (payment.type === 'IN') {
        credit = payment.amount;
        reference = 'سند قبض';
      } else if (payment.type === 'OUT') {
        debit = payment.amount;
        reference = 'سند صرف';
      } else if (payment.type === 'PAYMENT_COLLECTION') {
        credit = payment.amount;
        reference = 'سند تحصيل';
      }

      transactions.push({
        type: 'PAYMENT',
        date: payment.createdAt,
        reference,
        description: payment.description || 'حركة نقدية',
        debit,
        credit,
        paymentId: payment.id,
        details: [],
        user: payment.user?.name || 'غير معروف',
        safe: payment.safe?.name || 'غير محدد',
      });
    });

    // ترتيب الحركات بالتاريخ
    transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 6. حساب الرصيد التراكمي
    let runningBalance = 0;
    const transactionsWithBalance = transactions.map(t => {
      runningBalance += (t.debit - t.credit);
      return { ...t, balance: runningBalance };
    });

    // 7. الحسابات الإجمالية
    const summary = {
      totalOrders: orders.length,
      totalOrdersAmount: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      totalDeposits: payments
        .filter(p => p.type === 'PAYMENT_COLLECTION')
        .reduce((sum, p) => sum + p.amount, 0),
      totalReturns: returns.length,
      totalReturnsAmount: returns.reduce((sum, r) => sum + r.totalRefund, 0),
      totalPaymentsIn: payments
        .filter(p => p.type === 'IN' || p.type === 'PAYMENT_COLlection')
        .reduce((sum, p) => sum + p.amount, 0),
      totalPaymentsOut: payments
        .filter(p => p.type === 'OUT')
        .reduce((sum, p) => sum + p.amount, 0),
      currentBalance: runningBalance,
    };

    return {
      success: true,
      data: {
        customer,
        transactions: JSON.parse(JSON.stringify(transactionsWithBalance)),
        summary,
      },
    };
  } catch (error: any) {
    console.error('Error in getCustomerLedger:', error);
    return { success: false, error: error.message || 'فشل جلب البيانات' };
  }
}
// ========================================
// ملخص اليوم
// ========================================
export async function getSummaryByDateRange(startDate?: string, endDate?: string) {
  try {
    let start, end;

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    // 1. Fetch data in parallel within the date range
    const [orders, payments, returns] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { safe: true, customer: true, vendor: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.returnOrder.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          status: "COMPLETED",
        },
        include: {
          originalOrder: { include: { customer: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // NEW: Create a map of payments for each order
    const paymentsByOrderNo: { [key: number]: any[] } = {};
    payments.forEach((p) => {
      // We are interested in payments collected for an order
      if (p.type === 'PAYMENT_COLLECTION' && p.description) {
        const match = p.description.match(/#(\d+)/);
        if (match && match[1]) {
          const orderNo = parseInt(match[1], 10);
          if (!paymentsByOrderNo[orderNo]) {
            paymentsByOrderNo[orderNo] = [];
          }
          paymentsByOrderNo[orderNo].push({
            amount: p.amount,
            safe: p.safe?.name || 'غير محدد',
          });
        }
      }
    });

    // 2. Process Orders (with payment details)
    const ordersByCustomer: any = {};
    const totalOrdersAmount = orders.reduce((sum, order) => {
      const customerName = order.customer?.name || "عميل نقدي";
      if (!ordersByCustomer[customerName]) {
        ordersByCustomer[customerName] = { count: 0, total: 0, orders: [] };
      }
      ordersByCustomer[customerName].count += 1;
      ordersByCustomer[customerName].total += order.totalAmount;

      // Get payments for this specific order using the map
      const orderPayments = paymentsByOrderNo[order.orderNo] || [];

      ordersByCustomer[customerName].orders.push({
        id: order.id,
        orderNo: order.orderNo,
        total: order.totalAmount,
        time: order.createdAt,
        payments: orderPayments, // Attach payment details
      });
      return sum + order.totalAmount;
    }, 0);


    // 3. Process Payments (including refunds)
    const paymentsBySafe: any = {};
    let totalPaymentsIn = 0;
    let totalPaymentsOut_General = 0;
    let totalPaymentsOut_Refunds = 0;
    let totalPaymentsCollection = 0;

    payments.forEach((p) => {
      const safeName = p.safe?.name || "بدون خزنة";
      if (!paymentsBySafe[safeName]) {
        paymentsBySafe[safeName] = { in: 0, out: 0, collection: 0, refund: 0, count: 0 };
      }
      paymentsBySafe[safeName].count += 1;

      if (p.type === "IN") {
        paymentsBySafe[safeName].in += p.amount;
        totalPaymentsIn += p.amount;
      } else if (p.type === "OUT") {
        if (p.description?.includes("استرداد")) {
          paymentsBySafe[safeName].refund += p.amount;
          totalPaymentsOut_Refunds += p.amount;
        } else {
          paymentsBySafe[safeName].out += p.amount;
          totalPaymentsOut_General += p.amount;
        }
      } else if (p.type === "PAYMENT_COLLECTION") {
        paymentsBySafe[safeName].collection += p.amount;
        totalPaymentsCollection += p.amount;
      }
    });

    // 4. Process Returns
    const returnsByCustomer: any = {};
    const totalItemsReturnedValue = returns.reduce((sum, ret) => {
      const customerName = ret.originalOrder.customer?.name || "عميل نقدي";
      if (!returnsByCustomer[customerName]) {
        returnsByCustomer[customerName] = { count: 0, totalValue: 0, returns: [] };
      }
      const returnValue = ret.items.reduce((s, i) => s + i.refundAmount, 0);
      returnsByCustomer[customerName].count += 1;
      returnsByCustomer[customerName].totalValue += returnValue;
      returnsByCustomer[customerName].returns.push({
        id: ret.id,
        returnNo: ret.returnNo,
        value: returnValue,
        type: ret.type,
        time: ret.createdAt,
      });
      return sum + returnValue;
    }, 0);

    // 5. Process Sold Products
    const productsByVendor: any = {};
    const totalItemsSold = orders.reduce((sum, order) => {
        order.items.forEach((item) => {
            const vendorName = item.product?.vendor || "غير محدد";
            const key = vendorName;
            if (!productsByVendor[key]) {
                productsByVendor[key] = { quantity: 0, revenue: 0, models: new Set() };
            }
            productsByVendor[key].quantity += item.quantity;
            productsByVendor[key].revenue += item.quantity * item.price;
            productsByVendor[key].models.add(item.product.modelNo);
        });
        return sum + order.items.reduce((s, i) => s + i.quantity, 0);
    }, 0);

    const vendorsSummary = Object.entries(productsByVendor).map(([vendor, data]: [string, any]) => ({
        vendor,
        quantity: data.quantity,
        revenue: data.revenue,
        models: data.models.size,
    }));

    // 6. Final Calculations
    const netCash = totalPaymentsIn + totalPaymentsCollection - (totalPaymentsOut_General + totalPaymentsOut_Refunds);
    const totalRevenue = totalOrdersAmount - totalItemsReturnedValue;

    return {
      success: true,
      data: {
        dateRange: { 
            start: start.toISOString().split('T')[0], 
            end: end.toISOString().split('T')[0] 
        },
        orders: {
          total: totalOrdersAmount,
          count: orders.length,
          byCustomer: ordersByCustomer,
        },
        returns: {
          totalValue: totalItemsReturnedValue,
          totalCashRefund: totalPaymentsOut_Refunds,
          count: returns.length,
          byCustomer: returnsByCustomer,
        },
        payments: {
          totalIn: totalPaymentsIn,
          totalOut: totalPaymentsOut_General,
          totalOutRefunds: totalPaymentsOut_Refunds,
          totalCollection: totalPaymentsCollection,
          net: netCash,
          bySafe: paymentsBySafe,
        },
        products: {
          totalQuantity: totalItemsSold,
          totalRevenue: totalRevenue, // Net revenue
          byVendor: vendorsSummary,
        },
      },
    };
  } catch (error: any) {
    console.error("Error in getSummaryByDateRange:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 7. إدارة الموظفين والرواتب
// ==========================================

export async function getEmployees() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return { success: true, data: JSON.parse(JSON.stringify(employees)) };
  } catch (error: any) {
    console.error("Error fetching employees:", error);
    return { success: false, error: error.message };
  }
}

export async function addEmployee(data: { name: string; phone?: string; defaultSalary?: number }) {
  try {
    const { name, phone, defaultSalary } = data;
    if (!name) {
      return { success: false, error: "اسم الموظف مطلوب." };
    }
    const employee = await prisma.employee.create({
      data: {
        name,
        phone,
        defaultSalary: defaultSalary || 0,
      },
    });
    revalidatePath("/admin/employees");
    return { success: true, data: JSON.parse(JSON.stringify(employee)) };
  } catch (error: any) {
    console.error("Error adding employee:", error);
    if (error.code === 'P2002') {
        return { success: false, error: "يوجد موظف بنفس الاسم بالفعل." };
    }
    return { success: false, error: error.message };
  }
}

export async function updateEmployee(id: string, data: { name?: string; phone?: string; defaultSalary?: number }) {
  try {
    const { name, phone, defaultSalary } = data;
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name,
        phone,
        defaultSalary,
      },
    });
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}/ledger`);
    return { success: true, data: JSON.parse(JSON.stringify(employee)) };
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return { success: false, error: error.message };
  }
}

export async function createEmployeePayment(data: { employeeId: string; amount: number; description: string; safeId: string; transactionDate: Date; }, createdById: string) {
    const { employeeId, amount, description, safeId, transactionDate } = data;
    if (!employeeId || !amount || !safeId) {
        return { success: false, error: "بيانات غير مكتملة." };
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create a negative transaction for the employee (Debit)
            const transaction = await tx.employeeTransaction.create({
                data: {
                    employeeId,
                    amount: -Math.abs(amount), // Negative for debit
                    description,
                    safeId,
                    createdById,
                    transactionDate
                }
            });

            // 2. Create a corresponding general OUT payment from the safe
            await tx.payment.create({
                data: {
                    type: 'OUT',
                    amount: Math.abs(amount),
                    currency: 'EGP', 
                    safeId,
                    userId: createdById,
                    description: `صرف للموظف: ${description}`,
                    createdAt: transactionDate
                },
            });

            return transaction;
        });

        revalidatePath("/admin/employees");
        revalidatePath(`/admin/employees/${employeeId}/ledger`);
        revalidatePath('/admin/cash-management');
        return { success: true, data: result };

    } catch (error: any) {
        console.error("Error creating employee payment:", error);
        return { success: false, error: error.message };
    }
}

export async function createSalaryCredit(data: { employeeId: string; amount: number; description: string; transactionDate: Date; }, createdById: string) {
    const { employeeId, amount, description, transactionDate } = data;
    if (!employeeId || !amount) {
        return { success: false, error: "بيانات غير مكتملة." };
    }

    try {
        const transaction = await prisma.employeeTransaction.create({
            data: {
                employeeId,
                amount: Math.abs(amount), // Positive for credit
                description,
                createdById,
                transactionDate,
                safeId: null // Not a cash transaction
            }
        });

        revalidatePath("/admin/employees");
        revalidatePath(`/admin/employees/${employeeId}/ledger`);
        return { success: true, data: transaction };

    } catch (error: any) {
        console.error("Error creating salary credit:", error);
        return { success: false, error: error.message };
    }
}

export async function getEmployeeLedger(employeeId: string) {
  if (!employeeId) return { success: false, error: 'لم يتم تحديد الموظف' };

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return { success: false, error: 'الموظف غير موجود' };
    }

    const transactions = await prisma.employeeTransaction.findMany({
      where: { employeeId },
      include: {
        safe: true,
        createdBy: true,
      },
      orderBy: { transactionDate: 'asc' },
    });

    let runningBalance = 0;
    const transactionsWithBalance = transactions.map(t => {
      runningBalance += t.amount;
      return { ...t, balance: runningBalance };
    });
    
    const summary = {
      totalCredit: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      totalDebit: transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0),
      currentBalance: runningBalance
    };

    return {
      success: true,
      data: {
        employee: JSON.parse(JSON.stringify(employee)),
        transactions: JSON.parse(JSON.stringify(transactionsWithBalance.reverse())),
        summary,
      },
    };
  } catch (error: any) {
    console.error('Error in getEmployeeLedger:', error);
    return { success: false, error: error.message || 'فشل جلب البيانات' };
  }
}
