// prisma/seed.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  // 1. إنشاء موظف (أدمن)
  const hashedPassword = await bcrypt.hash('123456', 10)
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

  // 3. إنشاء منتج (موديل 3700 لون كافيه ولون أسود)
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })