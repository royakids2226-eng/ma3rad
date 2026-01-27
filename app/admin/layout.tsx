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
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return JSON.parse(JSON.stringify(users));
}

// --- 2. إدارة المنتجات ---
export async function addProduct(data: any) {
  try {
    // data = { modelNo, description, material, price, colors: [{color, stock}] }
    // سنقوم بإضافة كل لون كمنتج منفصل حسب تصميمنا
    for (const item of data.colors) {
        await prisma.product.create({
            data: {
                modelNo: data.modelNo,
                description: data.description,
                material: data.material,
                price: parseFloat(data.price),
                color: item.color,
                stockQty: parseInt(item.stock)
            }
        });
    }
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'حدث خطأ، ربما الموديل واللون مكرر' };
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
      orderBy: { createdAt: 'desc' },
      take: 50 // آخر 50 منتج
  });
  return JSON.parse(JSON.stringify(products));
}

// --- 3. إدارة العملاء ---
export async function addCustomer(data: any) {
    try {
      await prisma.customer.create({ data });
      revalidatePath('/admin/customers');
      return { success: true };
    } catch (e) { return { success: false, error: 'الكود مكرر' }; }
}

export async function deleteCustomer(id: string) {
    try {
        await prisma.customer.delete({ where: { id } });
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function getAdminCustomers() {
    const custs = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return JSON.parse(JSON.stringify(custs));
}