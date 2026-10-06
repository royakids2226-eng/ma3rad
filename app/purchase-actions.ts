'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { revalidatePath } from 'next/cache'

interface PurchaseLineItem {
  modelNo: string
  color: string
  quantity: number
  cost: number
  price?: number
  description?: string
}

interface PurchaseInvoicePayload {
  vendorId: string
  invoiceType: 'PURCHASE' | 'RETURN'
  paymentStatus: 'CREDIT' | 'CASH'
  safeId?: string
  invoiceNo?: string
  date?: string
  notes?: string
  items: PurchaseLineItem[]
}

async function checkAuthorizedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.image) {
    throw new Error('غير مصرح لك، يرجى تسجيل الدخول')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.image as string }
  })

  if (!user || !['ADMIN', 'OWNER', 'ACCOUNTANT'].includes(user.role)) {
    throw new Error('ليست لديك صلاحية للقيام بهذه العملية')
  }

  return user
}

export async function createPurchaseInvoice(data: PurchaseInvoicePayload) {
  try {
    const user = await checkAuthorizedUser()

    if (!data.vendorId) {
      return { success: false, error: 'يرجى تحديد المورد' }
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'يجب إضافة صنف واحد على الأقل' }
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId }
    })

    if (!vendor) {
      return { success: false, error: 'المورد غير موجود' }
    }

    const invoiceDate = data.date ? new Date(data.date) : new Date()
    const invoiceNumber = data.invoiceNo?.trim() || `PUR-${Date.now().toString().slice(-6)}`

    // تنظيف وتجميع البنود المتطابقة لتفادي أخطاء التكرار
    const consolidatedItemsMap = new Map<string, {
      modelNo: string
      color: string
      quantity: number
      cost: number
      price: number
      description?: string
    }>()

    for (const item of data.items) {
      const model = String(item.modelNo || '').trim()
      const color = String(item.color || '').trim() || 'افتراضي'
      const qty = Number(item.quantity) || 0
      const cost = Number(item.cost) || 0
      const price = Number(item.price) || (cost * 1.25)

      if (!model || qty <= 0) continue

      const key = `${model.toLowerCase()}|${color.toLowerCase()}`
      if (consolidatedItemsMap.has(key)) {
        const existing = consolidatedItemsMap.get(key)!
        existing.quantity += qty
        if (cost > 0) existing.cost = cost
        if (price > 0) existing.price = price
      } else {
        consolidatedItemsMap.set(key, {
          modelNo: model,
          color: color,
          quantity: qty,
          cost: cost,
          price: price,
          description: item.description
        })
      }
    }

    const finalItems = Array.from(consolidatedItemsMap.values())

    if (finalItems.length === 0) {
      return { success: false, error: 'لا توجد بنود صالحة بكميات صحيحة' }
    }

    const totalAmount = finalItems.reduce((sum, item) => sum + (item.quantity * item.cost), 0)

    if (totalAmount <= 0) {
      return { success: false, error: 'إجمالي الفاتورة يجب أن يكون أكبر من الصفر' }
    }

    if (data.paymentStatus === 'CASH' && !data.safeId) {
      return { success: false, error: 'يرجى اختيار الخزنة للدفع النقدي' }
    }

    // تنفيذ الـ Transaction
    await prisma.$transaction(
      async (tx) => {
        const modelList = Array.from(new Set(finalItems.map(i => i.modelNo)))
        const existingProducts = await tx.product.findMany({
          where: {
            modelNo: { in: modelList }
          }
        })

        const productMap = new Map<string, typeof existingProducts[0]>()
        existingProducts.forEach(p => {
          const key = `${p.modelNo.toLowerCase().trim()}|${p.color.toLowerCase().trim()}`
          productMap.set(key, p)
        })

        const isPurchase = data.invoiceType === 'PURCHASE'

        for (const item of finalItems) {
          const key = `${item.modelNo.toLowerCase()}|${item.color.toLowerCase()}`
          const existingProduct = productMap.get(key)

          if (existingProduct) {
            // ✅ التصحيح الأساسي هنا:
            // في الشراء: تزيد الكمية الحالية currentStock والمخزون الكلي
            // في المرتجع: ينقص فقط الرصيد المتاح currentStock حتى لو بالسالب،
            // بينما المخزون الأولي stockQty يظل كما هو دون تصفير!
            const currentStockDelta = isPurchase ? item.quantity : -item.quantity
            const stockQtyDelta = isPurchase ? item.quantity : 0 // لا نلمس المخزون الأولي بالسالب

            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                stockQty: { increment: stockQtyDelta },
                currentStock: { increment: currentStockDelta },
                cost: item.cost > 0 ? item.cost : existingProduct.cost,
                vendor: vendor.name,
                vendorId: vendor.id,
                description: item.description || existingProduct.description
              }
            })
          } else {
            // إذا كان صنفاً جديداً تماماً:
            // في الشراء: رصيده موجب
            // في المرتجع: رصيده الحالي سالب، والمخزون الأولي يظل صفر كبداية
            await tx.product.create({
              data: {
                modelNo: item.modelNo,
                color: item.color,
                stockQty: isPurchase ? item.quantity : 0, // المخزون الأولي لا يكون سالباً
                currentStock: isPurchase ? item.quantity : -item.quantity, // الرصيد المتاح يسمح بالسالب
                cost: item.cost,
                price: item.price,
                vendor: vendor.name,
                vendorId: vendor.id,
                description: item.description || ''
              }
            })
          }
        }

        // تسجيل حركة المورد
        const transType = isPurchase ? 'PURCHASE' : 'RETURN'
        const transDesc = isPurchase
          ? `فاتورة مشتريات #${invoiceNumber} (${data.paymentStatus === 'CASH' ? 'نقدي' : 'آجل'}) ${data.notes ? `- ${data.notes}` : ''}`
          : `مرتجع مشتريات للمورد #${invoiceNumber} (${data.paymentStatus === 'CASH' ? 'نقدي' : 'آجل'}) ${data.notes ? `- ${data.notes}` : ''}`

        await tx.vendorTransaction.create({
          data: {
            vendorId: vendor.id,
            type: transType,
            amount: totalAmount,
            description: transDesc,
            reference: invoiceNumber,
            userId: user.id,
            createdAt: invoiceDate
          }
        })

        // في حال الدفع النقدي
        if (data.paymentStatus === 'CASH' && data.safeId) {
          if (isPurchase) {
            await tx.payment.create({
              data: {
                type: 'OUT',
                amount: totalAmount,
                currency: 'EGP',
                safeId: data.safeId,
                vendorId: vendor.id,
                userId: user.id,
                description: `سداد نقدي لفاتورة مشتريات #${invoiceNumber} للمورد: ${vendor.name}`,
                createdAt: invoiceDate
              }
            })
          } else {
            await tx.payment.create({
              data: {
                type: 'IN',
                amount: totalAmount,
                currency: 'EGP',
                safeId: data.safeId,
                vendorId: vendor.id,
                userId: user.id,
                description: `استرداد نقدي لمرتجع مشتريات #${invoiceNumber} من المورد: ${vendor.name}`,
                createdAt: invoiceDate
              }
            })
          }
        }
      },
      {
        maxWait: 30000,
        timeout: 60000
      }
    )

    revalidatePath('/admin/products')
    revalidatePath('/admin/vendors')
    revalidatePath(`/admin/vendors/${vendor.id}`)
    revalidatePath('/admin/cash-management')
    revalidatePath('/admin/reports')

    return {
      success: true,
      message: data.invoiceType === 'PURCHASE' 
        ? `تم حفظ فاتورة المشتريات رقم #${invoiceNumber} وتحديث المخزون بنجاح` 
        : `تم حفظ مرتجع المشتريات رقم #${invoiceNumber} وتحديث المخزون بنجاح`
    }
  } catch (error: any) {
    console.error('Error creating purchase invoice:', error)
    return { success: false, error: error.message || 'حدث خطأ أثناء حفظ الفاتورة' }
  }
}

export async function searchProductsForPurchase(query: string) {
  try {
    if (!query || query.trim().length === 0) return []

    const q = query.trim()
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { modelNo: { contains: q, mode: 'insensitive' } },
          { color: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        cost: true,
        price: true,
        currentStock: true,
        description: true
      },
      take: 25
    })

    return products
  } catch (error) {
    console.error('Error searching products:', error)
    return []
  }
}

export async function getModelColors(modelNo: string) {
  try {
    if (!modelNo || modelNo.trim().length === 0) return []

    const products = await prisma.product.findMany({
      where: {
        modelNo: { equals: modelNo.trim(), mode: 'insensitive' }
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        cost: true,
        price: true,
        currentStock: true,
        description: true
      },
      orderBy: { color: 'asc' }
    })

    return products
  } catch (error) {
    console.error('Error fetching model colors:', error)
    return []
  }
}

export async function fetchProductsForExcelImport(items: { modelNo: string; color: string }[]) {
  try {
    if (!items || items.length === 0) return []

    const modelNos = Array.from(new Set(items.map(i => String(i.modelNo).trim())))

    const dbProducts = await prisma.product.findMany({
      where: {
        modelNo: { in: modelNos }
      },
      select: {
        id: true,
        modelNo: true,
        color: true,
        cost: true,
        price: true,
        currentStock: true,
        description: true
      }
    })

    return JSON.parse(JSON.stringify(dbProducts))
  } catch (error) {
    console.error('Error fetching products for Excel import:', error)
    return []
  }
}

export async function createQuickProduct(data: {
  modelNo: string
  color: string
  cost: number
  price: number
  description?: string
  vendorId?: string
}) {
  try {
    await checkAuthorizedUser()

    if (!data.modelNo || !data.color) {
      return { success: false, error: 'الموديل واللون مطلوبان' }
    }

    const existing = await prisma.product.findUnique({
      where: {
        modelNo_color: {
          modelNo: data.modelNo.trim(),
          color: data.color.trim()
        }
      }
    })

    if (existing) {
      return { success: false, error: 'هذا الصنف (الموديل مع اللون) مسجل بالفعل مسبقاً' }
    }

    let vendorName: string | undefined = undefined
    if (data.vendorId) {
      const v = await prisma.vendor.findUnique({ where: { id: data.vendorId } })
      if (v) vendorName = v.name
    }

    const product = await prisma.product.create({
      data: {
        modelNo: data.modelNo.trim(),
        color: data.color.trim(),
        cost: Number(data.cost) || 0,
        price: Number(data.price) || (Number(data.cost) * 1.25),
        description: data.description || '',
        vendor: vendorName,
        vendorId: data.vendorId || null,
        stockQty: 0,
        currentStock: 0,
        status: 'OPEN'
      }
    })

    revalidatePath('/admin/products')
    return { success: true, product }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// دالة تصحيح وترميم للأصناف التي تصفّر مخزونها الأولي بالخطأ
export async function fixCorruptedInitialStock() {
  try {
    await checkAuthorizedUser()

    const products = await prisma.product.findMany({
      where: {
        stockQty: { lte: 0 },
        currentStock: { not: 0 }
      },
      include: {
        orderItems: {
          include: { returnItems: true }
        }
      }
    })

    let fixedCount = 0

    for (const p of products) {
      const totalSoldFromOrders = p.orderItems.reduce((acc, item) => acc + (item.quantity || 0), 0)
      const totalReturned = p.orderItems.reduce(
        (acc, item) => acc + (item.returnItems?.reduce((sum, ret) => sum + ret.quantity, 0) || 0),
        0
      )
      const netSold = totalSoldFromOrders - totalReturned

      // استعادة المخزون الأولي: الرصيد المتاح الحالي + ما تم بيعه
      const restoredStockQty = Math.max(0, p.currentStock + netSold)

      if (restoredStockQty > 0) {
        await prisma.product.update({
          where: { id: p.id },
          data: { stockQty: restoredStockQty }
        })
        fixedCount++
      }
    }

    revalidatePath('/admin/products')
    revalidatePath('/admin/reports')

    return { success: true, message: `تم فحص وترميم المخزون الأولي لـ ${fixedCount} صنف بنجاح` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}