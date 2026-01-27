const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const code = 'admin' // كود الدخول
  const password = '123456' // كلمة المرور
  const name = 'المدير العام'

  console.log(`⏳ جاري إنشاء المستخدم: ${code}...`)

  // تشفير كلمة المرور
  const hashedPassword = await bcrypt.hash(password, 10)

  // استخدام upsert لإنشاء المستخدم أو تحديث كلمة مروره إذا كان موجوداً
  const user = await prisma.user.upsert({
    where: { code: code },
    update: {
      password: hashedPassword,
      role: 'OWNER' // صلاحية كاملة
    },
    create: {
      code: code,
      name: name,
      password: hashedPassword,
      role: 'OWNER'
    },
  })

  console.log('✅ تم إنشاء/تحديث المستخدم بنجاح!')
  console.log(`👤 الكود: ${user.code}`)
  console.log(`🔑 كلمة المرور: ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })