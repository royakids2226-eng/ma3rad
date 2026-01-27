'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// --- 1. إدارة المستخدمين ---
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

// --- 2. إدارة المنتجات (محدث) ---

export async function addProduct(data: any) {
  try {
    for (const item of data.colors) {
        await prisma.product.create({
            data: {
                modelNo: data.modelNo,
                description: data.description,
                material: data.material,
                price: parseFloat(data.price),
                color: item.color,
                stockQty: parseInt(item.stock),
                status: data.status || 'OPEN'
            }
        });
    }
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'حدث خطأ، ربما البيانات مكررة (الموديل واللون)' };
  }
}

// تعديل منتج واحد
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
                stockQty: parseInt(data.stockQty),
                status: data.status
            }
        });
        revalidatePath('/admin/products');
        return { success: true };
    } catch (e) {
        return { success: false, error: 'فشل التعديل، تأكد من عدم تكرار الموديل واللون' };
    }
}

export async function addBulkProducts(products: any[]) {
    try {
        let count = 0;
        for (const p of products) {
            if(p.modelNo && p.color) {
                const productStatus = (p.status && p.status.toUpperCase() === 'CLOSED') ? 'CLOSED' : 'OPEN';
                
                // نستخدم upsert لتحديث المنتج إذا كان موجوداً أو إنشائه إذا لم يكن
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
                        description: p.description || '',
                        status: productStatus
                    },
                    create: {
                        modelNo: String(p.modelNo),
                        description: p.description || '',
                        material: p.material || '',
                        color: String(p.color),
                        price: parseFloat(p.price) || 0,
                        stockQty: parseInt(p.stockQty) || 0,
                        status: productStatus
                    }
                });
                count++;
            }
        }
        revalidatePath('/admin/products');
        return { success: true, count };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'حدث خطأ أثناء الاستيراد' };
    }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) { return { success: false }; }
}

// حذف مجموعة منتجات مختارة
export async function deleteBulkProducts(ids: string[]) {
    try {
        await prisma.product.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        revalidatePath('/admin/products');
        return { success: true };
    } catch (e) { return { success: false, error: 'حدث خطأ أثناء الحذف' }; }
}

// حذف جميع المنتجات (تصفير المخزن)
export async function deleteAllProducts() {
    try {
        await prisma.product.deleteMany({});
        revalidatePath('/admin/products');
        return { success: true };
    } catch (e) { return { success: false, error: 'لا يمكن حذف المنتجات لوجود طلبات مرتبطة بها' }; }
}

export async function getProducts() {
  const products = await prisma.product.findMany({ 
      orderBy: { id: 'desc' },
      take: 200 // زيادة العدد قليلاً
  });
  return JSON.parse(JSON.stringify(products));
}

// --- 3. إدارة العملاء ---
export async function addCustomer(data: any) {
    try {
      await prisma.customer.create({ data });
      revalidatePath('/admin/customers');
      return { success: true };
    } catch (e) { return { success: false, error: 'كود العميل مكرر' }; }
}

export async function deleteCustomer(id: string) {
    try {
        await prisma.customer.delete({ where: { id } });
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function getAdminCustomers() {
    const custs = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    return JSON.parse(JSON.stringify(custs));
}