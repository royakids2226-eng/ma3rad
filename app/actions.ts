'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. جلب العملاء للقائمة المنسدلة
export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      take: 100,
      orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(customers));
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

// 2. بحث "لايف" عن المنتجات (بالكود)
export async function searchProducts(term: string) {
  if (!term || term.length < 2) return [];
  
  try {
    const products = await prisma.product.findMany({
      where: {
        modelNo: {
          contains: term,
          mode: 'insensitive'
        }
      },
      orderBy: { modelNo: 'asc' }
    });
    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.error("Error searching products:", error);
    return [];
  }
}

// 3. حفظ الأوردر (تم التعديل لاستقبال العربون)
export async function createOrder(data: any, userId: string) {
  // نستقبل العربون هنا (deposit)
  const { customerId, items, total, deposit } = data; 
  
  // تجهيز الأصناف لقاعدة البيانات
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
        deposit: deposit || 0, // حفظ العربون (أو صفر إذا لم يدخل شيئاً)
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

// 4. جلب تفاصيل الأوردر للطباعة
export async function getOrderById(orderId: string) {
  if (!orderId) return null;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        user: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!order) return null;
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}