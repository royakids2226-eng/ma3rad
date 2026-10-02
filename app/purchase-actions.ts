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

    const totalAmount = data.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.cost)), 0)

    if (totalAmount <= 0) {
      return { success: false, error: 'إجمالي الفاتورة يجب أن يكون أكبر من الصفر' }
    }

    if (data.paymentStatus === 'CASH' && !data.safeId) {
      return { success: false, error: 'يرجى اختيار الخزنة للدفع النقدي' }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        const qty = Number(item.quantity) || 0
        const itemCost = Number(item.cost) || 0
        const itemPrice = Number(item.price) || (itemCost * 1.25)
        const cleanedModelNo = String(item.modelNo).trim()
        const cleanedColor = String(item.color).trim() || 'افتراضي'

        let product = await tx.product.findUnique({
          where: {
            modelNo_color: {
              modelNo: cleanedModelNo,
              color: cleanedColor
            }
          }
        })

        const stockChange = data.invoiceType === 'PURCHASE' ? qty : -qty

        if (product) {
          if (data.invoiceType === 'RETURN' && product.currentStock < qty) {
            throw new Error(`الرصيد المتاح من الصنف ${cleanedModelNo} (${cleanedColor}) هو ${product.currentStock} فقط، لا يمكن إرجاع ${qty}`)
          }

          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQty: { increment: stockChange },
              currentStock: { increment: stockChange },
              cost: itemCost > 0 ? itemCost : product.cost,
              vendor: vendor.name,
              vendorId: vendor.id,
              description: item.description || product.description
            }
          })
        } else {
          if (data.invoiceType === 'RETURN') {
            throw new Error(`الصنف ${cleanedModelNo} (${cleanedColor}) غير موجود في النظام لعمل مرتجع عليه`)
          }

          await tx.product.create({
            data: {
              modelNo: cleanedModelNo,
              color: cleanedColor,
              stockQty: qty,
              currentStock: qty,
              cost: itemCost,
              price: itemPrice,
              vendor: vendor.name,
              vendorId: vendor.id,
              description: item.description || ''
            }
          })
        }
      }

      const isPurchase = data.invoiceType === 'PURCHASE'
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
    })

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

// دالة جديدة لجلب جميع ألوان الموديل المحدد لاقتراحها في خانة اللون
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