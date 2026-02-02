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
                discount: parseFloat(data.discount) || 0, // الخصم التلقائي
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
                discount: parseFloat(data.discount) || 0,
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
        return { success: true, deleted: res.count, failed: remaining };
    } catch (e) { return { success: false, error: 'حدث خطأ غير متوقع' }; }
}

export async function getProducts() {
  // السعة العالية لضمان ظهور الـ 1700 صنف
  const products = await prisma.product.findMany({ orderBy: { id: 'desc' }, take: 5000 });
  return JSON.parse(JSON.stringify(products));
}

// ==========================================
// 3. إدارة العملاء (Customers)
// ==========================================

export async function addCustomer(data: any) {
    try {
      const { name, phone, phone2, code, source, force } = data;

      // 1. التحقق من الاسم المتشابه (تجاهل الهمزات)
      const normalizedInputName = name.replace(/[أإآ]/g, 'ا');
      const existingByName: any[] = await prisma.$queryRaw`
        SELECT name FROM "Customer" 
        WHERE TRANSLATE(name, 'أإآ', 'ااا') = ${normalizedInputName}
        LIMIT 1
      `;
      
      if (existingByName.length > 0) {
          return { success: false, error: `الاسم موجود مسبقاً باسم: (${existingByName[0].name})` };
      }

      // 2. التحقق من تكرار الهاتف (إلا إذا تم الإجبار force)
      if (!force) {
          const phonesToCheck = [phone, phone2].filter(p => p && p.trim() !== "");
          if (phonesToCheck.length > 0) {
              const existingByPhone = await prisma.customer.findFirst({
                  where: {
                      OR: [
                          { phone: { in: phonesToCheck } },
                          { phone2: { in: phonesToCheck } },
                          { phone: { in: phonesToCheck.map(p => p) } } // ضمان البحث في كل الحقول
                      ]
                  },
                  select: { name: true }
              });

              if (existingByPhone) {
                  return { success: false, warning: true, existingName: existingByPhone.name };
              }
          }
      }

      // 3. توليد كود تلقائي
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
        console.error(e);
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