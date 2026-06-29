import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getCurrentUser } from "@/app/actions";
import Link from "next/link";
import { prisma } from '@/lib/prisma';

export default async function TodaySummaryPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.image) {
    redirect("/login");
  }

  const user = await getCurrentUser(session.user.image as string);
  
  if (!user) {
    redirect("/api/auth/signout");
  }

  const isAllowed = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'ACCOUNTANT';
  
  if (!isAllowed) {
    redirect("/");
  }

  // جلب البيانات
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    include: { safe: true, customer: true, vendor: true },
    orderBy: { createdAt: 'desc' },
  });

  // تجميع الأوردرات حسب العميل
  const ordersByCustomer: any = {};
  let totalOrdersAmount = 0;

  orders.forEach(order => {
    const name = order.customer?.name || 'عميل نقدي';
    if (!ordersByCustomer[name]) {
      ordersByCustomer[name] = { count: 0, total: 0, orders: [] };
    }
    ordersByCustomer[name].count += 1;
    ordersByCustomer[name].total += order.totalAmount;
    ordersByCustomer[name].orders.push(order);
    totalOrdersAmount += order.totalAmount;
  });

  // تجميع المدفوعات حسب الخزنة
  const paymentsBySafe: any = {};
  let totalIn = 0, totalOut = 0, totalCollection = 0;

  payments.forEach(p => {
    const safeName = p.safe?.name || 'بدون خزنة';
    if (!paymentsBySafe[safeName]) {
      paymentsBySafe[safeName] = { in: 0, out: 0, collection: 0, count: 0 };
    }
    paymentsBySafe[safeName].count += 1;
    
    if (p.type === 'IN') {
      paymentsBySafe[safeName].in += p.amount;
      totalIn += p.amount;
    } else if (p.type === 'OUT') {
      paymentsBySafe[safeName].out += p.amount;
      totalOut += p.amount;
    } else if (p.type === 'PAYMENT_COLLECTION') {
      paymentsBySafe[safeName].collection += p.amount;
      totalCollection += p.amount;
    }
  });

  // تجميع الأصناف حسب المورد
  const productsByVendor: any = {};
  let totalItemsSold = 0;
  let totalItemsRevenue = 0;

  orders.forEach(order => {
    order.items.forEach(item => {
      const vendor = item.product?.vendor || 'غير محدد';
      const key = vendor;
      
      if (!productsByVendor[key]) {
        productsByVendor[key] = { quantity: 0, revenue: 0, models: new Set() };
      }
      productsByVendor[key].quantity += item.quantity;
      productsByVendor[key].revenue += (item.quantity * item.price);
      productsByVendor[key].models.add(item.product?.modelNo);
      totalItemsSold += item.quantity;
      totalItemsRevenue += (item.quantity * item.price);
    });
  });

  // تحويل Set إلى عدد
  Object.keys(productsByVendor).forEach(key => {
    productsByVendor[key].modelsCount = productsByVendor[key].models.size;
    delete productsByVendor[key].models;
  });

  const formatMoney = (n: number) => n.toFixed(2);
  const formatDate = (d: Date) => d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center border-b-4 border-amber-500">
        <div>
          <h1 className="text-xl font-black text-gray-800"> ملخص اليوم</h1>
          <p className="text-xs text-gray-500">
            {today.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200">
          ← رجوع
        </Link>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* بطاقات الإجماليات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 rounded-xl shadow-lg">
            <div className="text-xs opacity-90">إجمالي الأوردرات</div>
            <div className="text-2xl font-black">{formatMoney(totalOrdersAmount)}</div>
            <div className="text-xs opacity-90">{orders.length} فاتورة</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-4 rounded-xl shadow-lg">
            <div className="text-xs opacity-90">القبض اليوم</div>
            <div className="text-2xl font-black">{formatMoney(totalIn + totalCollection)}</div>
            <div className="text-xs opacity-90">تحصيل + قبض</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-4 rounded-xl shadow-lg">
            <div className="text-xs opacity-90">الصرف اليوم</div>
            <div className="text-2xl font-black">{formatMoney(totalOut)}</div>
            <div className="text-xs opacity-90">مصروفات + مورد</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 rounded-xl shadow-lg">
            <div className="text-xs opacity-90">صافي النقدية</div>
            <div className="text-2xl font-black">{formatMoney(totalIn + totalCollection - totalOut)}</div>
            <div className="text-xs opacity-90">الداخل - الخارج</div>
          </div>
        </div>

        {/* الأصناف المباعة حسب المورد */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span>الأصناف المباعة حسب المورد</span>
            <span className="text-sm text-gray-500 mr-auto">
              {totalItemsSold} قطعة | {formatMoney(totalItemsRevenue)} ج.م
            </span>
          </h2>
          
          {Object.keys(productsByVendor).length === 0 ? (
            <div className="text-center text-gray-500 py-8">لا توجد مبيعات اليوم</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(productsByVendor).map(([vendor, data]: [string, any]) => (
                <div key={vendor} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-gray-800">🏪 {vendor}</div>
                    <div className="text-sm">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {data.quantity} قطعة
                      </span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold mr-1">
                        {formatMoney(data.revenue)} ج.م
                      </span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold mr-1">
                        {data.modelsCount} موديل
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* النقدية حسب الخزنة */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <span>حركة النقدية حسب الخزنة</span>
          </h2>
          
          {Object.keys(paymentsBySafe).length === 0 ? (
            <div className="text-center text-gray-500 py-8">لا توجد حركات اليوم</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(paymentsBySafe).map(([safe, data]: [string, any]) => (
                <div key={safe} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-gray-800">🏦 {safe}</div>
                    <div className="text-xs text-gray-500">{data.count} عملية</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs text-gray-600">قبض</div>
                      <div className="font-bold text-green-700">{formatMoney(data.in)}</div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-xs text-gray-600">تحصيل</div>
                      <div className="font-bold text-blue-700">{formatMoney(data.collection)}</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-xs text-gray-600">صرف</div>
                      <div className="font-bold text-red-700">{formatMoney(data.out)}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                    <span className="text-gray-600">الصافي:</span>
                    <span className={`font-bold ${data.in + data.collection - data.out >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatMoney(data.in + data.collection - data.out)} ج.م
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* الأوردرات حسب العميل */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl"></span>
            <span>الأوردرات حسب العميل</span>
            <span className="text-sm text-gray-500 mr-auto">
              {orders.length} فاتورة | {formatMoney(totalOrdersAmount)} ج.م
            </span>
          </h2>
          
          {Object.keys(ordersByCustomer).length === 0 ? (
            <div className="text-center text-gray-500 py-8">لا توجد أوردرات اليوم</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(ordersByCustomer).map(([customer, data]: [string, any]) => (
                <div key={customer} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-gray-800">👤 {customer}</div>
                    <div className="text-sm">
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">
                        {data.count} فاتورة
                      </span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold mr-1">
                        {formatMoney(data.total)} ج.م
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {data.orders.map((order: any) => (
                      <Link 
                        key={order.id}
                        href={`/orders/${order.id}/print`}
                        className="flex justify-between items-center text-xs bg-gray-50 hover:bg-blue-50 p-2 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">فاتورة #{order.orderNo}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">{formatDate(order.createdAt)}</span>
                        </div>
                        <span className="font-bold text-gray-700">{formatMoney(order.totalAmount)} ج.م</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-xs pb-4">
          تم التحديث: {new Date().toLocaleString('ar-EG')}
        </div>
      </div>
    </div>
  );
}