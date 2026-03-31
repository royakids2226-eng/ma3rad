
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSettings } from "@/app/actions";
import PrintButton from "./PrintButton";
import HomeButton from "./HomeButton";
import NewOrderButton from "./NewOrderButton";
import SharePdfButton from "./SharePdfButton";
import PrintStyles from "./PrintStyles";

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

  const PIECE_MULTIPLIER = 4;

  // --- CALCULATIONS ---

  const grossTotal = order.items.reduce((acc, item) => {
    const quantityInPieces = item.quantity * PIECE_MULTIPLIER;
    const originalPricePerDozen = item.product.price;
    return acc + (quantityInPieces * originalPricePerDozen);
  }, 0);

  const totalItemsDiscount = order.items.reduce((acc, item) => {
    const quantityInPieces = item.quantity * PIECE_MULTIPLIER;
    const originalPricePerDozen = item.product.price;
    const itemGrossTotal = quantityInPieces * originalPricePerDozen;
    const discountAmount = itemGrossTotal * (item.discountPercent / 100);
    return acc + discountAmount;
  }, 0);

  const orderLevelDiscount = order.discount;
  const totalDiscount = totalItemsDiscount + orderLevelDiscount;

  const netTotal = grossTotal - totalDiscount;

  const depositPaid = order.deposit;
  const depositDeducted = order.currency === 'EGP' ? depositPaid : 0;
  const remainingAmount = netTotal - depositDeducted;

  const groupedItems = order.items.reduce((acc, item) => {
    const modelNo = item.product.modelNo;
    if (!acc[modelNo]) {
      acc[modelNo] = {
        items: [],
        totalDozenQuantity: 0,
        originalPricePerDozen: item.product.price,
        description: item.product.description || '',
        discountPercent: item.discountPercent,
      };
    }
    acc[modelNo].items.push(item);
    acc[modelNo].totalDozenQuantity += item.quantity;
    return acc;
  }, {} as Record<string, { items: any[], totalDozenQuantity: number, originalPricePerDozen: number, description: string, discountPercent: number }>);

  return (
    <div className="bg-gray-100 min-h-screen" dir="rtl">
      <PrintStyles siteName={settings?.siteName || 'Ma3rad'} customerName={order.customer.name} />
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

      <div id="printable-area" className="bg-white text-black p-8 font-sans text-sm max-w-4xl mx-auto shadow-lg">

        {/* --- Header --- */}
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
          <div className="mt-6 border-t-2 border-gray-300 pt-4 break-words">
              <p><strong>العميل:</strong> {order.customer.name}</p>
              <p><strong>الهاتف:</strong> {order.customer.phone}</p>
              {order.customer.address && <p><strong>العنوان:</strong> {order.customer.address}</p>}
          </div>
        </div>

        {/* --- Items Table --- */}
        <table className="w-full text-right border-collapse mb-8">
          <thead className="border-b-2 border-black bg-gray-100">
            <tr>
              <th className="p-2 font-semibold">م</th>
              <th className="p-2 font-semibold text-right">الموديل</th>
              <th className="p-2 font-semibold text-right">التفاصيل</th>
              <th className="p-2 font-semibold">الكمية</th>
              <th className="p-2 font-semibold">السعر</th>
              <th className="p-2 font-semibold">خصم %</th>
              <th className="p-2 font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedItems).map((modelNo, index) => {
              const group = groupedItems[modelNo];
              const quantityInPieces = group.totalDozenQuantity * PIECE_MULTIPLIER;
              const originalPricePerDozen = group.originalPricePerDozen;
              const details = group.items.map(item => `${item.quantity * PIECE_MULTIPLIER} ${item.product.color}`).join(' + ');
              
              const rowGrossTotal = quantityInPieces * originalPricePerDozen;

              return (
                <tr key={modelNo} className="border-b border-gray-200">
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2 text-right">{modelNo}</td>
                  <td className="p-2 text-right">
                    {group.description} ({details})
                  </td>
                  <td className="p-2">{quantityInPieces}</td>
                  <td className="p-2">{originalPricePerDozen.toFixed(2)}</td>
                  <td className="p-2 text-red-500">{group.discountPercent.toFixed(2)}</td>
                  <td className="p-2 font-bold">{rowGrossTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* --- Footer --- */}
        <div className="flex justify-between items-start">
          <div className="w-2/5">
              <h3 className="font-bold mb-2">الملاحظات:</h3>
              {order.notes && <p className="text-xs mt-1">{order.notes}</p>}
              {settings?.invoiceNotes && <p className="text-xs mt-1 text-gray-600">{settings.invoiceNotes}</p>}
              
              {order.currency !== 'EGP' && depositPaid > 0 && (
                  <div className="mt-4 p-2 border border-blue-400 bg-blue-50 rounded-lg">
                      <h4 className="font-bold text-blue-800">سجل تحصيلات العملات</h4>
                      <p className="text-sm text-blue-700">
                         تم استلام عربون بقيمة {depositPaid.toFixed(2)} {order.currency}
                      </p>
                  </div>
              )}
          </div>

          <div className="w-1/3">
            <div className="border border-gray-300 p-4 rounded-lg">
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <span>{grossTotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>إجمالي الخصم:</span>
                  <span>({totalDiscount.toFixed(2)})</span>
                </div>
              )}
              <hr className="my-2"/>
              <div className="flex justify-between font-bold">
                <span>صافي الفاتورة:</span>
                <span>{netTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span>{depositPaid.toFixed(2)} {order.currency !== 'EGP' ? `(${order.currency})` : ''}</span>
              </div>
              <hr className="my-2"/>
              <div className="flex justify-between font-bold text-lg text-green-600">
                <span>المتبقي:</span>
                <span>{remainingAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
