const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  // تجهيز الباسورد المشفر الموحد (123456)
  const hashedPassword = await bcrypt.hash('123456', 10)

  // 1. إنشاء موظف (أدمن)
  await prisma.user.upsert({
    where: { code: '1001' },
    update: {},
    create: {
      code: '1001',
      name: 'مدير النظام',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  // 👇 1-ب. إنشاء محاسب (جديد)
  await prisma.user.upsert({
    where: { code: '2000' },
    update: {},
    create: {
      code: '2000',
      name: 'المحاسب العام',
      password: hashedPassword,
      role: 'ACCOUNTANT',
    },
  })

  // 👇 1-ج. إنشاء صاحب الشركة (جديد)
  await prisma.user.upsert({
    where: { code: '3000' },
    update: {},
    create: {
      code: '3000',
      name: 'صاحب الشركة',
      password: hashedPassword,
      role: 'OWNER',
    },
  })

  // 2. إنشاء عميل
  await prisma.customer.upsert({
    where: { code: 'CUST01' },
    update: {},
    create: {
      code: 'CUST01',
      name: 'محلات الأمل',
      phone: '01000000000',
      address: 'القاهرة - وسط البلد',
    },
  })

  // 3. إنشاء منتج
  const products = [
    { modelNo: '3700', color: 'كافيه', price: 185, stockQty: 32 },
    { modelNo: '3700', color: 'أسود', price: 185, stockQty: 20 },
  ]
  for (const p of products) {
    await prisma.product.upsert({
      where: { modelNo_color: { modelNo: p.modelNo, color: p.color } },
      update: {},
      create: {
        modelNo: p.modelNo,
        description: 'جيبة 3700',
        material: 'mag1300.12',
        color: p.color,
        stockQty: p.stockQty,
        price: p.price,
      },
    })
  }

  // 4. إضافة الخزن
  const safes = ['الخزنة الرئيسية', 'انستا باي', 'فودافون كاش', 'الشيخ محمد فؤاد', 'خزنة تسليم'];
  for (const safeName of safes) {
    const existing = await prisma.safe.findFirst({ where: { name: safeName } });
    if (!existing) {
      await prisma.safe.create({ data: { name: safeName } });
    }
  }
  
  console.log("Seeding completed successfully (Users, Roles, Customers, Products, Safes).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })