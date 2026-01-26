'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. جلب العملاء
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      take: 100,
      orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) {
    return [];
  }
}

// 👇 2. جلب الخزن (الجديد)
export async function getSafes() {
  try {
    const safes = await prisma.safe.findMany({
      orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(safes));
  } catch (error) {
    return [];
  }
}

// 3. بحث المنتجات
export async function searchProducts(term: string) {
  if (!term || term.length < 2) return [];
  try {
    const products = await prisma.product.findMany({
      where: {
        modelNo: { contains: term, mode: 'insensitive' }
      },
      orderBy: { modelNo: 'asc' }
    });
    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    return [];
  }
}

// 4. حفظ الأوردر (تم التعديل لاستقبال safeId)
export async function createOrder(data: any, userId: string) {
  // نستقبل safeId مع البيانات
  const { customerId, items, total, deposit, safeId } = data; 
  
  const dbItems: any[] = [];
  items.forEach((cartItem: any) => {
    cartItem.variants.forEach((variant: any) => {
      dbItems.push({
        productId: variant.productId,
        quantity: variant.quantity,
        price: variant.price
      });
    });
  });

  try {
    const order = await prisma.order.create({
      data: {
        userId,
        customerId,
        totalAmount: total,
        deposit: deposit || 0,
        // 👇 ربط الخزنة (لو مفيش عربون ممكن يكون null)
        safeId: deposit > 0 ? safeId : null, 
        items: {
          create: dbItems
        }
      }
    });
    
    revalidatePath('/');
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    console.error("Error creating order:", error);
    return null;
  }
}

// 5. جلب تفاصيل الأوردر للطباعة
export async function getOrderById(orderId: string) {
  if (!orderId) return null;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        user: true,
        items: { include: { product: true } }
      }
    });
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    return null;
  }
}