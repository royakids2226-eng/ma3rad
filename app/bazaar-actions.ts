'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

interface BazaarOrderItem {
  productId: string
  quantity: number // يمكن أن تكون سالبة (مرتجع/استبدال) أو موجبة (بيع)
  price: number
  discountPercent?: number
}

interface PaymentSplit {
  safeId: string
  safeName?: string
  amount: number
}

interface PendingBazaarOrder {
  id: string
  items: BazaarOrderItem[]
  totalAmount: number
  paymentSplits: PaymentSplit[]
  notes?: string
  createdAt?: string
}

// جلب كتالوج كل الأصناف النشطة لتخزينها محلياً والعمل بها أوفلاين
export async function getBazaarProductsCatalog() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        modelNo: true,
        color: true,
        price: true,
        cost: true,
        currentStock: true,
        description: true,
        status: true
      },
      orderBy: { modelNo: 'asc' }
    })

    return {
      success: true,
      products: JSON.parse(JSON.stringify(products))
    }
  } catch (error: any) {
    console.error('Error fetching bazaar products catalog:', error)
    return { success: false, error: error.message || 'فشل جلب كتالوج الأصناف' }
  }
}

// تهيئة عميل وخزنة البازار الافتراضية مع جلب كل الخزن المتاحة
export async function getOrCreateBazaarDefaults() {
  try {
    let customer = await prisma.customer.findFirst({
      where: { name: 'البازار' }
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: 'البازار',
          code: 'BAZAAR-001',
          source: 'BAZAAR',
          address: 'مبيعات البازار المباشرة'
        }
      })
    }

    let defaultSafe = await prisma.safe.findFirst({
      where: { name: 'خزنة البازار' }
    })

    if (!defaultSafe) {
      defaultSafe = await prisma.safe.create({
        data: {
          name: 'خزنة البازار'
        }
      })
    }

    // جلب باقي الخزن لاختيار انستا باي أو فودافون كاش
    const allSafes = await prisma.safe.findMany({
      orderBy: { name: 'asc' }
    })

    return {
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      defaultSafeId: defaultSafe.id,
      defaultSafeName: defaultSafe.name,
      allSafes: JSON.parse(JSON.stringify(allSafes))
    }
  } catch (error: any) {
    console.error('Error getting bazaar defaults:', error)
    return { success: false, error: error.message || 'فشل تهيئة إعدادات البازار' }
  }
}

// حفظ مجموعة الأوردرات دفعة واحدة مع دعم التوزيع على الخزن والكميات السالبة
export async function saveBulkBazaarOrders(payload: {
  orders: PendingBazaarOrder[]
  userId: string
  customerId: string
  defaultSafeId: string
}) {
  try {
    const { orders, userId, customerId, defaultSafeId } = payload

    if (!orders || orders.length === 0) {
      return { success: false, error: 'لا توجد أوردرات معلقة للحفظ' }
    }

    const createdOrderNumbers: number[] = []

    await prisma.$transaction(async (tx) => {
      for (const ord of orders) {
        if (!ord.items || ord.items.length === 0) continue

        // تحديد الخزنة الرئيسية للأوردر
        const primarySafeId = ord.paymentSplits?.[0]?.safeId || defaultSafeId

        // 1. إنشاء الأوردر
        const newOrder = await tx.order.create({
          data: {
            userId,
            customerId,
            safeId: primarySafeId,
            totalAmount: ord.totalAmount,
            deposit: ord.totalAmount, // خالص الحساب
            currency: 'EGP',
            notes: ord.notes || 'فاتورة مبيعات سريعة - نمط البازار',
            items: {
              create: ord.items.map(it => ({
                productId: it.productId,
                quantity: it.quantity, // تسجل سالبة للمرتجع أو موجبة للبيع
                price: it.price,
                discountPercent: it.discountPercent || 0
              }))
            }
          }
        })

        createdOrderNumbers.push(newOrder.orderNo)

        // 2. تحديث المخزون (لو الكمية موجبة ينقص المخزون، لو سالبة مرتجع يزيد المخزون تلقائياً)
        for (const it of ord.items) {
          await tx.product.update({
            where: { id: it.productId },
            data: {
              currentStock: { decrement: it.quantity }
            }
          })
        }

        // 3. إنشاء حركات الخزنة حسب التوزيع (تقسيم الخزن)
        const splits = (ord.paymentSplits && ord.paymentSplits.length > 0)
          ? ord.paymentSplits.filter(s => s.amount !== 0)
          : [{ safeId: defaultSafeId, amount: ord.totalAmount }]

        for (const split of splits) {
          if (split.amount > 0) {
            // قبض نقدي
            await tx.payment.create({
              data: {
                type: 'IN',
                amount: split.amount,
                currency: 'EGP',
                safeId: split.safeId,
                customerId: customerId,
                userId: userId,
                description: `تحصيل نقدي لأوردر بازار #${newOrder.orderNo}`
              }
            })
          } else if (split.amount < 0) {
            // صرف نقدي (في حال كان الأوردر مرتجع بالكامل ومبلغه سالب)
            await tx.payment.create({
              data: {
                type: 'OUT',
                amount: Math.abs(split.amount),
                currency: 'EGP',
                safeId: split.safeId,
                customerId: customerId,
                userId: userId,
                description: `استرداد نقدي لمرتجع بازار #${newOrder.orderNo}`
              }
            })
          }
        }
      }
    }, {
      maxWait: 30000,
      timeout: 90000
    })

    revalidatePath('/')
    revalidatePath('/orders/list')
    revalidatePath('/admin/cash-management')
    revalidatePath('/admin/reports')
    revalidatePath('/today-summary')

    return {
      success: true,
      count: createdOrderNumbers.length,
      orderNumbers: createdOrderNumbers,
      message: `تم بنجاح حفظ ${createdOrderNumbers.length} أوردر وتوزيع النقدية وتحديث المخزون بدقة.`
    }
  } catch (error: any) {
    console.error('Error saving bulk bazaar orders:', error)
    return { success: false, error: error.message || 'حدث خطأ أثناء حفظ الأوردرات' }
  }
}