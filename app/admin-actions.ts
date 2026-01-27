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
  // نستخدم الترتيب بـ id تنازلياً ليظهر الأحدث أولاً
  const users = await prisma.user.findMany({ orderBy: { id: 'desc' } });
  return JSON.parse(JSON.stringify(users));
}

// --- 2. إدارة المنتجات (محدث) ---

export async function addProduct(data: any) {
  try {
    // data = { modelNo, description, material, price, status, colors: [{color, stock}] }
    // نقوم بإضافة كل لون كمنتج منفصل في قاعدة البيانات
    for (const item of data.colors) {
        await prisma.product.create({
            data: {
                modelNo: data.modelNo,
                description: data.description,
                material: data.material,
                price: parseFloat(data.price),
                color: item.color,
                stockQty: parseInt(item.stock),
                status: data.status || 'OPEN' // 👈 حفظ الحالة (مفتوح/مغلق)
            }
        });
    }
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'حدث خطأ، ربما البيانات مكررة' };
  }
}

// 👇 دالة الاستيراد من الإكسيل (Bulk Import)
export async function addBulkProducts(products: any[]) {
    try {
        let count = 0;
        for (const p of products) {
            // نتأكد من وجود البيانات الأساسية (الموديل واللون)
            if(p.modelNo && p.color) {
                // تحويل الحالة من النص للتنسيق المناسب
                // نفترض أن في الإكسيل العمود اسمه status وقيمته OPEN أو CLOSED
                const productStatus = (p.status && p.status.toUpperCase() === 'CLOSED') ? 'CLOSED' : 'OPEN';

                await prisma.product.create({
                    data: {
                        modelNo: String(p.modelNo),
                        description: p.description || '',
                        material: p.material || '',
                        color: String(p.color),
                        price: parseFloat(p.price) || 0,
                        stockQty: parseInt(p.stockQty) || 0, // لاحظ: يجب أن يكون اسم العمود في الاكسيل stockQty
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
        return { success: false, error: 'حدث خطأ أثناء الاستيراد، تأكد من عدم تكرار الموديل واللون' };
    }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) { return { success: false }; }
}

export async function getProducts() {
  const products = await prisma.product.findMany({ 
      orderBy: { id: 'desc' },
      take: 100 // جلب آخر 100 صنف
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