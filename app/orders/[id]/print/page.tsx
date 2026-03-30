import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSettings } from "@/app/admin-actions";

export default async function OrderPrintPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      orderItems: { include: { product: true } },
      payments: true,
    },
  });

  const settings = await getSettings();

  if (!order) {
    notFound();
  }

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const totalAmount = order.orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const remainingAmount = totalAmount - totalPaid;

  return (
    <div id="printable-area" className="bg-white text-black p-4 font-sans text-sm" dir="rtl">
      
      {/* === الهيدر: مساحة فارغة للورق المطبوع مسبقاً === */}
      <div id="page-header">
        {/* This is intentionally left empty to leave space for the pre-printed header */}
      </div>

      {/* === المحتوى الرئيسي === */}
      <main id="page-content" className="px-4 md:px-8">
        <div className="border-b-2 border-black pb-2 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h2 className="font-bold text-lg">فاتورة مبيعات</h2>
              <p>رقم الفاتورة: {order.id.slice(-6)}</p>
              <p>التاريخ: {new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold">{settings?.siteName || 'Ma3rad'}</h1>
            </div>
          </div>
          <div className="mt-4 border-t border-gray-300 pt-2">
            <p><strong>العميل:</strong> {order.customer.name}</p>
            <p><strong>الهاتف:</strong> {order.customer.phone}</p>
            {order.customer.address && <p><strong>العنوان:</strong> {order.customer.address}</p>}
          </div>
        </div>

        <table className="w-full text-right border-collapse">
          <thead className="border-b-2 border-black">
            <tr>
              <th className="p-2">م</th>
              <th className="p-2">الصنف</th>
              <th className="p-2">الكمية</th>
              <th className="p-2">السعر</th>
              <th className="p-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="p-2">{index + 1}</td>
                <td className="p-2">
                  {item.product.modelNo} - {item.product.color}
                  {item.product.description && <span className="text-xs text-gray-500"> ({item.product.description})</span>}
                </td>
                <td className="p-2">{item.quantity}</td>
                <td className="p-2">{item.price.toFixed(2)}</td>
                <td className="p-2">{(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-1/3">
            <div className="flex justify-between font-bold">
              <span>إجمالي الفاتورة:</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>المدفوع:</span>
              <span>{totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-black mt-1 pt-1">
              <span>المتبقي:</span>
              <span>{remainingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-bold">الملاحظات:</h3>
          {settings?.invoiceNotes && <p className="text-xs mt-1">{settings.invoiceNotes}</p>}
          {order.notes && <p className="text-xs mt-1">{order.notes}</p>}
        </div>
      </main>

      {/* === الفوتر: مساحة فارغة للورق المطبوع مسبقاً === */}
      <footer id="page-footer">
        {/* This is intentionally left empty to leave space for the pre-printed footer */}
      </footer>

    </div>
  );
}
