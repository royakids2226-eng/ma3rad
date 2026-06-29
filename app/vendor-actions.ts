'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

// ========================================
// 1. جلب كل الموردين
// ========================================
export async function getVendors() {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return vendors
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return []
  }
}

// ========================================
// 2. جلب مورد واحد
// ========================================
export async function getVendorById(vendorId: string) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        products: {
          select: {
            id: true,
            modelNo: true,
            color: true,
            currentStock: true,
            price: true,
          },
        },
        transactions: {
          include: {
            product: true,
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    return vendor
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return null
  }
}

// ========================================
// 3. إضافة مورد جديد
// ========================================
export async function addVendor(data: {
  name: string
  phone?: string
  phone2?: string
  code?: string
  address?: string
  notes?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.image) {
      return { success: false, error: 'غير مصرح' }
    }

    let code = data.code
    if (!code) {
      const lastVendor = await prisma.vendor.findFirst({
        orderBy: { createdAt: 'desc' },
      })
      const lastNumber = lastVendor?.code ? parseInt(lastVendor.code.replace('V', '')) : 0
      code = `V${String(lastNumber + 1).padStart(4, '0')}`
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: data.name,
        code,
        phone: data.phone,
        phone2: data.phone2,
        address: data.address,
        notes: data.notes,
      },
    })

    return { success: true, vendor }
  } catch (error: any) {
    console.error('Error adding vendor:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 4. تحديث مورد
// ========================================
export async function updateVendor(vendorId: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.image) {
      return { success: false, error: 'غير مصرح' }
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
    })

    return { success: true, vendor }
  } catch (error: any) {
    console.error('Error updating vendor:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 5. حذف مورد
// ========================================
export async function deleteVendor(vendorId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.image) {
      return { success: false, error: 'غير مصرح' }
    }

    const productsCount = await prisma.product.count({
      where: { vendorId },
    })

    if (productsCount > 0) {
      return { success: false, error: 'لا يمكن حذف مورد لديه منتجات مرتبطة' }
    }

    await prisma.vendor.delete({
      where: { id: vendorId },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting vendor:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 6. تسجيل حركة مورد (استلام بضاعة)
// ========================================
export async function recordVendorPurchase(data: {
  vendorId: string
  productId?: string
  quantity?: number
  amount: number
  description?: string
  reference?: string
}, userId: string) {
  try {
    const transaction = await prisma.vendorTransaction.create({
      data: {
        vendorId: data.vendorId,
        productId: data.productId,
        quantity: data.quantity,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        type: 'PURCHASE',
        userId,
      },
    })

    return { success: true, transaction }
  } catch (error: any) {
    console.error('Error recording purchase:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 7. حساب رصيد المورد
// ========================================
export async function getVendorBalance(vendorId: string) {
  try {
    const transactions = await prisma.vendorTransaction.findMany({
      where: { vendorId },
    })

    let credit = 0
    let debit = 0

    transactions.forEach(t => {
      if (t.type === 'PURCHASE' || t.type === 'RETURN') {
        credit += t.amount
      } else if (t.type === 'PAYMENT') {
        debit += t.amount
      }
    })

    const balance = credit - debit

    return {
      success: true,
      balance,
      credit,
      debit,
      transactionsCount: transactions.length,
    }
  } catch (error: any) {
    console.error('Error calculating balance:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 8. جلب كشف حساب المورد (دفتر الأستاذ)
// ========================================
export async function getVendorLedger(vendorId: string) {
  try {
    console.log('🔍 Getting ledger for vendor:', vendorId)
    
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    })

    if (!vendor) {
      return { success: false, error: 'المورد غير موجود' }
    }

    // ✅ جلب المنتجات بالاسم (مش بالـ vendorId)
    const products = await prisma.product.findMany({
      where: { vendor: vendor.name }, // ✅ الربط بالاسم
      select: {
        id: true,
        modelNo: true,
        color: true,
        stockQty: true,
        cost: true,
        vendor: true,
      },
    })

    console.log('📦 Found products:', products.length)

    // جلب حركات VendorTransaction
    const transactions = await prisma.vendorTransaction.findMany({
      where: { vendorId },
      include: {
        product: true,
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // جلب سندات الدفع
    const payments = await prisma.payment.findMany({
      where: { 
        vendorId,
        type: 'OUT',
      },
      include: {
        safe: true,
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const ledger: any[] = []

    // ✅ حساب إجمالي المشتريات من المنتجات (سطر واحد)
    let productsTotal = 0
    let totalQuantity = 0
    
    products.forEach(p => {
      const amount = p.stockQty * p.cost
      productsTotal += amount
      totalQuantity += p.stockQty
    })

    console.log('💰 Products Total:', productsTotal)
    console.log('📦 Total Quantity:', totalQuantity)

    // ✅ إضافة سطر واحد إجمالي للمشتريات
    if (productsTotal > 0) {
      ledger.push({
        type: 'PURCHASE',
        date: new Date('2020-01-01'), // تاريخ رمزي
        reference: `مشتريات أصناف`,
        description: `إجمالي قيمة المخزون (${products.length} صنف، ${totalQuantity} قطعة)`,
        debit: 0,
        credit: productsTotal,
        productName: null,
        quantity: totalQuantity,
        user: 'النظام',
        isFromProducts: true,
      })
    }

    // إضافة حركات VendorTransaction (فواتير مسجلة)
    transactions.forEach(t => {
      if (t.type === 'PURCHASE') {
        ledger.push({
          type: 'PURCHASE',
          date: t.createdAt,
          reference: t.reference || `فاتورة شراء`,
          description: t.description || 'فاتورة شراء من المورد',
          debit: 0,
          credit: t.amount,
          productName: t.product ? `${t.product.modelNo} - ${t.product.color}` : null,
          quantity: t.quantity,
          user: t.user?.name || 'غير معروف',
        })
      } else if (t.type === 'RETURN') {
        ledger.push({
          type: 'RETURN',
          date: t.createdAt,
          reference: t.reference || `مرتجع للمورد`,
          description: t.description || 'مرتجع للمورد',
          debit: t.amount,
          credit: 0,
          productName: t.product ? `${t.product.modelNo} - ${t.product.color}` : null,
          quantity: t.quantity,
          user: t.user?.name || 'غير معروف',
        })
      }
    })

    // إضافة سندات الدفع
    payments.forEach(p => {
      ledger.push({
        type: 'PAYMENT',
        date: p.createdAt,
        reference: `سند دفع #${p.receiptNo}`,
        description: p.description || 'دفع للمورد',
        debit: p.amount,
        credit: 0,
        productName: null,
        quantity: null,
        user: p.user?.name || 'غير معروف',
        safe: p.safe?.name || 'غير محدد',
      })
    })

    // ترتيب حسب التاريخ
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // حساب الرصيد التراكمي
    let runningBalance = 0
    const ledgerWithBalance = ledger.map(t => {
      runningBalance += (t.credit - t.debit)
      return { ...t, balance: runningBalance }
    })

    // الحسابات الإجمالية
    const totalPurchasesFromProducts = productsTotal
    const totalPurchasesFromInvoices = ledger
      .filter(t => t.type === 'PURCHASE' && !t.isFromProducts)
      .reduce((sum, t) => sum + t.credit, 0)
    
    const summary = {
      totalPurchasesFromProducts,
      totalPurchasesFromInvoices,
      totalPurchases: totalPurchasesFromProducts + totalPurchasesFromInvoices,
      totalReturns: ledger.filter(t => t.type === 'RETURN').reduce((sum, t) => sum + t.debit, 0),
      totalPayments: ledger.filter(t => t.type === 'PAYMENT').reduce((sum, t) => sum + t.debit, 0),
      currentBalance: runningBalance,
      productsCount: products.length,
    }

    return {
      success: true,
      data: {
        vendor,
        ledger: JSON.parse(JSON.stringify(ledgerWithBalance)),
        summary,
        products: JSON.parse(JSON.stringify(products)),
      },
    }
  } catch (error: any) {
    console.error('Error in getVendorLedger:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 9. البحث عن الموردين
// ========================================
export async function searchVendors(query: string) {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    })
    return vendors
  } catch (error) {
    console.error('Error searching vendors:', error)
    return []
  }
}

// ========================================
// 10. حساب إجمالي مشتريات المورد من المنتجات
// ========================================
export async function getVendorPurchasesFromProducts(vendorId: string) {
  try {
    const products = await prisma.product.findMany({
      where: { vendorId },
      select: {
        id: true,
        modelNo: true,
        color: true,
        stockQty: true,
        cost: true,
      },
    })

    let totalAmount = 0
    const productsList = products.map(p => {
      const amount = p.stockQty * p.cost
      totalAmount += amount
      return {
        id: p.id,
        modelNo: p.modelNo,
        color: p.color,
        quantity: p.stockQty,
        cost: p.cost,
        total: amount,
      }
    })

    return {
      success: true,
      data: {
        products: productsList,
        totalAmount,
        productsCount: products.length,
      },
    }
  } catch (error: any) {
    console.error('Error in getVendorPurchasesFromProducts:', error)
    return { success: false, error: error.message }
  }
}

// ========================================
// 11. تسجيل فاتورة شراء للمورد (يدوي)
// ========================================
export async function recordVendorInvoice(data: {
  vendorId: string
  invoiceNo: string
  amount: number
  date?: string
  notes?: string
}, userId: string) {
  try {
    const transaction = await prisma.vendorTransaction.create({
      data: {
        vendorId: data.vendorId,
        amount: data.amount,
        description: data.notes || `فاتورة شراء رقم ${data.invoiceNo}`,
        reference: data.invoiceNo,
        type: 'PURCHASE',
        userId,
        createdAt: data.date ? new Date(data.date) : new Date(),
      },
    })

    return { success: true, transaction }
  } catch (error: any) {
    console.error('Error recording invoice:', error)
    return { success: false, error: error.message }
  }
}
