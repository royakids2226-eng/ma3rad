
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSettings } from "@/app/actions";
import PrintButton from "./PrintButton";
import HomeButton from "./HomeButton";
import NewOrderButton from "./NewOrderButton";
import SharePdfButton from "./SharePdfButton";
import PrintStyles from "./PrintStyles"; // Import the new client component

export default async function OrderPrintPage({ params }: { params: { id: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const order = await prisma.order.findUnique({
    where: { id: resolvedParams.id },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  });

  const settings = await getSettings();

  if (!order) {
    notFound();
  }

  const DOZEN_MULTIPLIER = 4;

  const grossTotal = order.items.reduce((acc, item) => {
    const quantity = item.quantity * DOZEN_MULTIPLIER;
    return acc + (item.price * quantity);
  }, 0);

  const totalItemsDiscount = order.items.reduce((acc, item) => {
    const quantity = item.quantity * DOZEN_MULTIPLIER;
    const itemDiscountValue = item.price * (item.discountPercent / 100);
    return acc + (itemDiscountValue * quantity);
  }, 0);

  const orderDiscount = order.discount;
  const totalDiscount = totalItemsDiscount + orderDiscount;
  const netTotal = grossTotal - totalDiscount;
  const totalPaid = order.deposit;
  const remainingAmount = netTotal - totalPaid;

  return (
    <div className="bg-gray-100 min-h-screen" dir="rtl">
      <PrintStyles /> {/* Use the PrintStyles component */}
      {/* Action Buttons with no-print class */}
      <div className="no-print flex justify-center gap-4 p-4 bg-white shadow-md mb-8">
        <PrintButton />
        <HomeButton />
        <NewOrderButton />
        <SharePdfButton
          customerName={order.customer.name}
          orderNo={order.orderNo}
          phone={order.customer.phone}
        />
      </div>

      {/* Printable Invoice content */}
      <div id="invoice-content" className="bg-white text-black p-8 font-sans text-sm max-w-4xl mx-auto shadow-lg">
        
        <header id="page-header" style={{ height: settings?.header || 'auto' }} className="mb-8 text-center">
            {/* Header for pre-printed paper */}
        </header>

        <main id="page-content">
          <div className="border-b-4 border-black pb-4 mb-6">
            <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <h2 className="font-bold text-2xl">فاتورة مبيعات</h2>
                    <p className="text-gray-600">رقم الفاتورة: {order.id.slice(-6)}</p>
                    <p className="text-gray-600">التاريخ: {new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="text-left">
                    <h1 className="text-4xl font-extrabold">{settings?.siteName || 'Ma3rad'}</h1>
                </div>
            </div>
            <div className="mt-6 border-t-2 border-gray-300 pt-4">
                <p><strong>العميل:</strong> {order.customer.name}</p>
                <p><strong>الهاتف:</strong> {order.customer.phone}</p>
                {order.customer.address && <p><strong>العنوان:</strong> {order.customer.address}</p>}
            </div>
        </div>

          <table className="w-full text-right border-collapse mb-8">
            <thead className="border-b-2 border-black bg-gray-100">
              <tr>
                <th className="p-2 font-semibold">م</th>
                <th className="p-2 font-semibold text-right">الصنف</th>
                <th className="p-2 font-semibold">الكمية</th>
                <th className="p-2 font-semibold">السعر</th>
                <th className="p-2 font-semibold">الخصم</th>
                <th className="p-2 font-semibold">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const quantity = item.quantity * DOZEN_MULTIPLIER;
                const itemDiscountValue = item.price * (item.discountPercent / 100);
                const rowDiscount = itemDiscountValue * quantity;
                const rowTotal = (item.price * quantity) - rowDiscount;
                
                return (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2 text-right">
                      {item.product.modelNo} - {item.product.color}
                      {item.product.description && <span className="text-xs text-gray-500"> ({item.product.description})</span>}
                    </td>
                    <td className="p-2">{quantity}</td>
                    <td className="p-2">{item.price.toFixed(2)}</td>
                    <td className="p-2 text-red-500">{rowDiscount > 0 ? `-${rowDiscount.toFixed(2)}` : '0.00'}</td>
                    <td className="p-2 font-bold">{rowTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-between items-start">
            <div className="w-2/5">
                <h3 className="font-bold mb-2">الملاحظات:</h3>
                {order.currency !== 'EGP' && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-md mb-4 text-xs" role="alert">
                    <strong className="font-bold">تنبيه: </strong>
                    تم استلام العربون بعملة أجنبية ({order.currency}).
                    </div>
                )}
                {settings?.invoiceNotes && <p className="text-xs mt-1 text-gray-600">{settings.invoiceNotes}</p>}
                {order.notes && <p className="text-xs mt-1">{order.notes}</p>}
            </div>

            <div className="w-1/3">
              <div className="border border-gray-300 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span>إجمالي الأصناف:</span>
                  <span>{grossTotal.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>إجمالي الخصم:</span>
                    <span>-{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <hr className="my-2"/>
                <div className="flex justify-between font-bold">
                  <span>صافي الفاتورة:</span>
                  <span>{netTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>المدفوع:</span>
                  <span>{totalPaid.toFixed(2)}</span>
                </div>
                <hr className="my-2"/>
                <div className="flex justify-between font-bold text-lg text-green-600">
                  <span>المتبقي:</span>
                  <span>{remainingAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer id="page-footer" style={{ height: settings?.footer || 'auto' }} className="mt-8 text-center text-xs text-gray-500">
            {/* Footer for pre-printed paper */}
        </footer>
      </div>
    </div>
  );
}
