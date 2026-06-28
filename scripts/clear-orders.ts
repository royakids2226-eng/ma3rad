import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearData() {
  console.log('⚠️  بدء عملية المسح...')
  console.log('⚠️  سيتم مسح: الأوردرات، المرتجعات، حركات النقدية')
  console.log('✅ سيتم الحفاظ على: المنتجات، العملاء')
  
  const confirm = process.argv[2]
  if (confirm !== '--yes') {
    console.log('\n🛑 للتأكيد، شغل الأمر مع --yes:')
    console.log('   npx tsx scripts/clear-orders.ts --yes\n')
    await prisma.$disconnect()
    return
  }

  try {
    // 1. المرتجعات (أولاً لأن فيها foreign keys للأوردرات)
    console.log('\n🗑️  [1/5] مسح عناصر المرتجعات...')
    const returnItems = await prisma.returnItem.deleteMany()
    console.log(`   ✅ تم مسح ${returnItems.count} عنصر`)

    console.log('\n🗑️  [2/5] مسح المرتجعات...')
    const returns = await prisma.returnOrder.deleteMany()
    console.log(`   ✅ تم مسح ${returns.count} مرتجع`)

    // 2. حركات النقدية
    console.log('\n💰 [3/5] مسح حركات النقدية...')
    const payments = await prisma.payment.deleteMany()
    console.log(`   ✅ تم مسح ${payments.count} حركة`)

    // 3. عناصر الأوردرات
    console.log('\n📦 [4/5] مسح عناصر الأوردرات...')
    const orderItems = await prisma.orderItem.deleteMany()
    console.log(`   ✅ تم مسح ${orderItems.count} عنصر`)

    // 4. الأوردرات
    console.log('\n📋 [5/5] مسح الأوردرات...')
    const orders = await prisma.order.deleteMany()
    console.log(`   ✅ تم مسح ${orders.count} أوردر`)

    // 5. إعادة تعيين المخزون للقيمة الأصلية
    console.log('\n📊 إعادة تعيين المخزون للقيمة الأصلية...')
    const products = await prisma.product.findMany()
    let updated = 0
    for (const product of products) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          currentStock: product.stockQty || 0,
        },
      })
      updated++
    }
    console.log(`   ✅ تم تحديث ${updated} منتج`)

    console.log('\n✅✅✅ تم المسح بنجاح! ✅✅✅')
    console.log('\n الملخص:')
    console.log(`   - المرتجعات: ${returns.count}`)
    console.log(`   - حركات النقدية: ${payments.count}`)
    console.log(`   - عناصر الأوردرات: ${orderItems.count}`)
    console.log(`   - الأوردرات: ${orders.count}`)
    console.log(`   - المنتجات المحدثة: ${updated}`)
    console.log('\n⚠️  المنتجات والعملاء لم يتم المساس بهم')

  } catch (error: any) {
    console.error('\n❌ خطأ:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

clearData()