'use server'
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// معامل التحويل (عدد القطع في الدزينة أو الوحدة)
const PIECES_PER_UNIT = 4;

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

    const PIECES_PER_UNIT = 4; // التأكد من نفس المعامل

    const logicalProducts = products.map((p) => {
      const initialPieces = p.stockQty || 0;

      // حساب إجمالي القطع المباعة
      const totalSoldPieces = p.orderItems.reduce((acc, item) => {
        return acc + (item.quantity || 0) * PIECES_PER_UNIT;
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
  const { customerId, items, total, deposit, safeId, currency, notes } = data;

  if (deposit > 0 && !safeId) {
    return { success: false, error: "عند وجود دفعة مقدمة، يجب تحديد الخزنة." };
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
            safeId: deposit > 0 ? safeId : null,
          },
          include: { customer: true },
        });

        const orderItemsData = allVariants.map((variant) => ({
          orderId: order.id,
          productId: variant.productId,
          quantity: variant.quantity,
          price: variant.price,
          discountPercent: variant.discountPercent || 0,
        }));

        await tx.orderItem.createMany({ data: orderItemsData });

        // 3. Efficiently update product stock
        // Instead of sending N update commands, we build a single raw SQL query
        // This is dramatically faster for large orders.
        const productsToUpdate = products.filter((p) => p.status !== "OPEN");
        if (productsToUpdate.length > 0) {
          const caseStatement = productsToUpdate
            .map(
              (p) =>
                `WHEN id = '${p.id}' THEN "currentStock" - ${productQuantities.get(p.id)}`,
            )
            .join(" ");

          const idList = productsToUpdate.map((p) => `'${p.id}'`).join(",");

          const query = `UPDATE "Product" SET "currentStock" = CASE ${caseStatement} END WHERE id IN (${idList})`;

          await tx.$executeRawUnsafe(query);
        }

        if (deposit > 0) {
          await tx.payment.create({
            data: {
              type: "PAYMENT_COLLECTION",
              amount: deposit,
              currency: currency || "EGP",
              safeId: safeId!,
              userId: userId,
              customerId: customerId,
              description: `تحصيل دفعة للأوردر رقم #${order.orderNo} للعميل: ${order.customer.name}`,
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
  const { customerId, items, total, deposit, safeId, currency, notes } = data;

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Fetch old items (including product details for error messages)
        const oldItems = await tx.orderItem.findMany({
          where: { orderId },
          include: { product: true }, // Include product for error messages and logic
        });

        // 2. Prepare a map of new items for easy lookup
        const newItemsMap = new Map<
          string,
          {
            quantity: number;
            price: number;
            discountPercent: number;
            productId: string;
          }
        >();
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
            if (
              oldItem.quantity !== newItem.quantity ||
              oldItem.price !== newItem.price ||
              oldItem.discountPercent !== newItem.discountPercent
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
          await tx.orderItem.create({
            data: {
              orderId: orderId,
              productId: itemToAdd.productId,
              quantity: itemToAdd.quantity,
              price: itemToAdd.price,
              discountPercent: itemToAdd.discountPercent,
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

          await tx.orderItem.update({
            where: { id: oldItem.id },
            data: {
              quantity: newItem.quantity,
              price: newItem.price,
              discountPercent: newItem.discountPercent,
            },
          });
        }

        // 7. Update the order itself
        await tx.order.update({
          where: { id: orderId },
          data: {
            customerId: customerId,
            totalAmount: total,
            deposit: deposit || 0,
            currency: currency || "EGP",
            safeId: deposit > 0 ? safeId : null,
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
  const {
    type,
    amount,
    currency,
    safeId,
    customerId,
    targetSafeId,
    description,
  } = data;
  try {
    await prisma.payment.create({
      data: {
        type,
        amount: parseFloat(amount),
        currency: currency || "EGP",
        safeId,
        userId,
        customerId: customerId || null,
        targetSafeId: targetSafeId || null,
        description: description || "",
      },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, error: "فشل العملية" };
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
            type: "REFUND",
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

    // 3. جلب كل المرتجعات
    const returns = await prisma.returnOrder.findMany({
      where: { originalOrder: { customerId } },
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

      // لو فيه عربون، نضيفه كحركة منفصلة
      if (order.deposit > 0) {
        transactions.push({
          type: 'DEPOSIT',
          date: order.createdAt,
          reference: `عربون أوردر #${order.orderNo}`,
          description: `دفعة مقدمة للأوردر`,
          debit: 0,
          credit: order.deposit,
          orderId: order.id,
          details: [],
          user: order.user?.name || 'غير معروف',
        });
      }
    });

    // إضافة المرتجعات
    returns.forEach(ret => {
      const typeLabel = ret.type === 'FULL' ? 'مرتجع كامل' : 
                       ret.type === 'PARTIAL' ? 'مرتجع جزئي' : 'استبدال';
      
      transactions.push({
        type: 'RETURN',
        date: ret.createdAt,
        reference: `مرتجع #${ret.returnNo}`,
        description: `${typeLabel} - أوردر #${ret.originalOrder.orderNo}`,
        debit: 0,
        credit: ret.totalRefund + Math.abs(ret.exchangeAmount || 0),
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

      // لو فيه فرق استبدال موجب (العميل يدفع)
      if (ret.type === 'EXCHANGE' && ret.exchangeAmount > 0) {
        transactions.push({
          type: 'EXCHANGE_DIFF',
          date: ret.createdAt,
          reference: `فرق استبدال #${ret.returnNo}`,
          description: `فرق سعر استبدال`,
          debit: ret.exchangeAmount,
          credit: 0,
          returnId: ret.id,
          details: [],
          user: ret.user?.name || 'غير معروف',
        });
      }
    });

    // إضافة حركات النقدية
    payments.forEach(payment => {
      const isDebit = payment.type === 'IN' || payment.type === 'PAYMENT_COLLECTION';
      
      transactions.push({
        type: 'PAYMENT',
        date: payment.createdAt,
        reference: `سند ${payment.type === 'IN' ? 'قبض' : payment.type === 'OUT' ? 'صرف' : 'تحصيل'}`,
        description: payment.description || 'حركة نقدية',
        debit: isDebit ? payment.amount : 0,
        credit: !isDebit ? payment.amount : 0,
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
      totalDeposits: orders.reduce((sum, o) => sum + (o.deposit || 0), 0),
      totalReturns: returns.length,
      totalReturnsAmount: returns.reduce((sum, r) => sum + r.totalRefund, 0),
      totalPaymentsIn: payments
        .filter(p => p.type === 'IN' || p.type === 'PAYMENT_COLLECTION')
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