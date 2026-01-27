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
// 2. إدارة المنتجات (Products) - (معدل)
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
                color: item.color,
                stockQty: parseInt(item.stock),
                status: data.status || 'OPEN'
            }
        });
    }
    revalidatePath('/admin/products');
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
                stockQty: parseInt(data.stockQty),
                status: data.status
            }
        });
        revalidatePath('/admin/products');
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

// حذف منتج واحد
export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin/products');
    return { success: true };
  } catch (e) { 
      return { success: false, error: 'لا يمكن حذف الصنف لأنه موجود في طلبات سابقة' }; 
  }
}

// حذف مجموعة منتجات (مع التخطي)
export async function deleteBulkProducts(ids: string[]) {
    let deleted = 0;
    let failed = 0;
    for(const id of ids) {
        try {
            await prisma.product.delete({ where: { id } });
            deleted++;
        } catch(e) { failed++; }
    }
    revalidatePath('/admin/products');
    return { success: true, deleted, failed };
}

// حذف جميع المنتجات (مع التخطي)
export async function deleteAllProducts() {
    try {
        // جلب كل الآيديهات
        const all = await prisma.product.findMany({ select: { id: true } });
        const ids = all.map(p => p.id);

        let deleted = 0;
        let failed = 0;
        for(const id of ids) {
            try {
                await prisma.product.delete({ where: { id } });
                deleted++;
            } catch(e) { failed++; }
        }

        revalidatePath('/admin/products');
        return { success: true, deleted, failed };
    } catch (e) { return { success: false, error: 'حدث خطأ غير متوقع' }; }
}

export async function getProducts() {
  const products = await prisma.product.findMany({ orderBy: { id: 'desc' }, take: 200 });
  return JSON.parse(JSON.stringify(products));
}

// ==========================================
// 3. إدارة العملاء (Customers)
// ==========================================

export async function addCustomer(data: any) {
    try {
      await prisma.customer.create({ 
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
    } catch (e) { return { success: false, error: 'كود العميل مكرر' }; }
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
    } catch (e) { return { success: false, error: 'حدث خطأ' }; }
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
                        address: c.address || ''
                    }
                });
                count++;
            }
        }
        revalidatePath('/admin/customers');
        return { success: true, count };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'حدث خطأ أثناء الاستيراد' };
    }
}

export async function deleteCustomer(id: string) {
    try {
        await prisma.customer.delete({ where: { id } });
        revalidatePath('/admin/customers');
        return { success: true };
    } catch (e) { 
        return { success: false, error: 'لا يمكن حذف العميل لوجود طلبات أو مدفوعات مسجلة باسمه' }; 
    }
}

export async function deleteBulkCustomers(ids: string[]) {
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
        try {
            await prisma.customer.delete({ where: { id } });
            deleted++;
        } catch (e) { failed++; }
    }
    revalidatePath('/admin/customers');
    return { success: true, deleted, failed };
}

export async function deleteAllCustomers() {
    try {
        const allCustomers = await prisma.customer.findMany({ select: { id: true } });
        const ids = allCustomers.map(c => c.id);
        
        let deleted = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                await prisma.customer.delete({ where: { id } });
                deleted++;
            } catch (e) { failed++; }
        }
        revalidatePath('/admin/customers');
        return { success: true, deleted, failed };
    } catch (e) { return { success: false, error: 'حدث خطأ غير متوقع', deleted: 0, failed: 0 }; }
}

export async function getAdminCustomers() {
    const custs = await prisma.customer.findMany({ orderBy: { id: 'desc' } });
    return JSON.parse(JSON.stringify(custs));
}