import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSettings } from "@/app/actions";
import PrintButton from "./PrintButton";
import HomeButton from "./HomeButton";
import NewOrderButton from "./NewOrderButton";
import SharePdfButton from "./SharePdfButton";
import PrintStyles from "./PrintStyles";
import PrintStylesReceipt from "./PrintStylesReceipt";

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const order = await prisma.order.findUnique({
    where: { id: resolvedParams.id },
    include: {
      customer: true,
      items: { 
        include: { product: true },
        orderBy: { product: { modelNo: 'asc' } } // Sort items for consistent display
      },
    },
  });

  const settings = await getSettings();

  if (!order) {
    notFound();
  }

  // Correctly group items by model, price, and discount to handle manual price changes
  const groupedItems = order.items.reduce((acc, item) => {
    // Use a composite key to group items only if model, price, and discount are identical
    const key = `${item.product.modelNo}|${item.price.toFixed(2)}|${item.discountPercent.toFixed(2)}`;
    
    if (!acc[key]) {
      acc[key] = {
        modelNo: item.product.modelNo,
        description: item.product.description || '',
        items: [],
        totalQuantity: 0,
        unitPrice: item.price, // Use the price from the OrderItem, which may be manual
        discountPercent: item.discountPercent,
      };
    }
    
    acc[key].items.push(item);
    acc[key].totalQuantity += item.quantity;
    return acc;
  }, {} as Record<string, { modelNo: string, description: string, items: any[], totalQuantity: number, unitPrice: number, discountPercent: number }>);

  // --- Start Corrected Total Calculations ---

  // Calculate totals based on the grouped items to ensure consistency
  const grossTotal = Object.values(groupedItems).reduce((acc, group) => {
    return acc + (group.totalQuantity * group.unitPrice);
  }, 0);

  const totalItemsDiscount = Object.values(groupedItems).reduce((acc, group) => {
    const groupGrossTotal = group.totalQuantity * group.unitPrice;
    const discountAmount = groupGrossTotal * (group.discountPercent / 100);
    return acc + discountAmount;
  }, 0);
  
  // Order-level discount is deprecated in new logic but kept for old orders
  const orderLevelDiscount = order.discount; 
  const totalDiscount = totalItemsDiscount + orderLevelDiscount;
  const netTotal = grossTotal - totalDiscount;

  const depositPaid = order.deposit;
  // This logic seems specific. I'll keep it.
  const depositDeducted = order.currency === 'EGP' ? depositPaid : 0; 
  const remainingAmount = netTotal - depositDeducted;

  // --- End Corrected Total Calculations ---

  return (
    <div className="bg-gray-100 min-h-screen" dir="rtl">
      <PrintStyles siteName={settings?.siteName || ''} customerName={order.customer.name} />
      <PrintStylesReceipt siteName={settings?.siteName || ''} customerName={order.customer.name} />
      
      <div className="no-print flex flex-wrap justify-center gap-2 md:gap-4 p-4 bg-white shadow-md mb-4 md:mb-8">
        <PrintButton />
        <HomeButton />
        <NewOrderButton />
        <SharePdfButton
          customerName={order.customer.name}
          orderNo={order.orderNo}
          phone={order.customer.phone}
        />
      </div>

      <div id="invoice-content" className="bg-white text-gray-800 p-4 md:p-8 font-sans text-sm max-w-4xl mx-auto my-4 md:my-8 shadow-lg border-t-8 border-blue-600">

        {/* --- Header --- */}
        <header className="mb-10">
          <div className="text-right">
            {settings?.siteName && <h1 className="text-3xl font-bold text-gray-900">{settings.siteName}</h1>}
            {settings?.siteAddress && <p className="text-gray-500">{settings.siteAddress}</p>}
          </div>
          <div className="mt-6 md:mt-8 border-t border-gray-200 pt-4 md:pt-6">
            <table className="w-full">
                <tbody>
                    <tr>
                        <td><span className="font-semibold">رقم الفاتورة:</span> {order.orderNo}</td>
                        <td><span className="font-semibold">التاريخ:</span> {new Date(order.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                    <tr>
                        <td className="pt-2"><span className="font-semibold">العميل:</span> {order.customer.name}</td>
                        <td className="pt-2"><span className="font-semibold">الهاتف:</span> {order.customer.phone}</td>
                         {order.customer.address && <td className="pt-2"><span className="font-semibold">العنوان:</span> {order.customer.address}</td>}
                    </tr>
                </tbody>
            </table>
          </div>
        </header>

        {/* --- Items Table --- */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse border border-gray-300 mb-10">
            <thead>
              <tr className="bg-slate-200">
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-center">م</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-right">الموديل</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-right">التفاصيل</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-center">الكمية</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-center">السعر</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-center">خصم %</th>
                <th className="p-3 font-semibold text-gray-800 border border-gray-300 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(groupedItems).map((group, index) => {
                const details = group.items.map(item => `${item.quantity} ${item.product.color}`).join(' + ');
                const rowGrossTotal = group.totalQuantity * group.unitPrice;
                const rowNetTotal = rowGrossTotal * (1 - group.discountPercent / 100); // Calculate net total for the row

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3 border border-gray-300 text-center">{index + 1}</td>
                    <td className="p-3 border border-gray-300 text-right font-medium text-gray-800">{group.modelNo}</td>
                    <td className="p-3 border border-gray-300 text-right text-sm text-gray-600">
                      {group.description} ({details})
                    </td>
                    <td className="p-3 border border-gray-300 text-center">{group.totalQuantity}</td>
                    <td className="p-3 border border-gray-300 text-center">{group.unitPrice.toFixed(2)}</td>
                    <td className="p-3 border border-gray-300 text-center text-red-500">{group.discountPercent.toFixed(2)}</td>
                    <td className="p-3 border border-gray-300 text-center font-semibold">{rowNetTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- Footer & Totals --- */}
        <footer className="flex flex-col-reverse md:flex-row md:justify-between items-start pt-6 border-t-2 border-gray-200">
          <div className="w-full md:w-2/5 md:pr-4 mt-6 md:mt-0">
              <h3 className="font-semibold text-gray-700 mb-2">ملاحظات</h3>
              {order.notes && <p className="text-sm text-gray-600">{order.notes}</p>}
              {settings?.invoiceNotes && <p className="text-xs mt-2 text-gray-500">{settings.invoiceNotes}</p>}
              
              {order.currency !== 'EGP' && depositPaid > 0 && (
                  <div className="mt-4 p-3 border border-blue-200 bg-blue-50 rounded-lg">
                      <h4 className="font-bold text-blue-800">سجل تحصيلات العملات</h4>
                      <p className="text-sm text-blue-700">
                         تم استلام عربون بقيمة {depositPaid.toFixed(2)} {order.currency}
                      </p>
                  </div>
              )}
          </div>

          <div className="w-full md:w-1/2">
            <div className="border border-gray-200 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-2 text-gray-600">
                <span>الإجمالي قبل الخصم:</span>
                <span>{grossTotal.toFixed(2)} ج.م</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between items-center mb-3 text-red-500">
                  <span>إجمالي الخصم:</span>
                  <span>({totalDiscount.toFixed(2)}) ج.م</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg mb-3 pt-3 border-t border-gray-200">
                <span>صافي الفاتورة:</span>
                <span>{netTotal.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center mb-3 text-gray-600">
                <span>المدفوع:</span>
                <span>{depositPaid.toFixed(2)} {order.currency !== 'EGP' ? `(${order.currency})` : 'ج.م'}</span>
              </div>
              <div className="flex justify-between items-center font-extrabold text-xl text-green-600 pt-3 border-t-2 border-green-200">
                <span>المبلغ المتبقي:</span>
                <span>{remainingAmount.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
