import { getOrderById } from "@/app/actions";
import PrintButton from "./PrintButton";
import NewOrderButton from "./NewOrderButton";
import HomeButton from "./HomeButton";
import { prisma } from "@/lib/prisma";

const PIECES_PER_UNIT = 4;

function groupOrderItems(items: any[]) {
    const grouped: any = {};
    items.forEach(item => {
        const key = `${item.product.modelNo}_${item.discountPercent}`;
        
        if (!grouped[key]) {
            const finalPrice = item.price;
            const discountPct = item.discountPercent || 0;
            const originalPrice = discountPct > 0 
                ? finalPrice / (1 - (discountPct / 100)) 
                : finalPrice;

            grouped[key] = {
                modelNo: item.product.modelNo,
                desc: item.product.description,
                originalPrice: originalPrice,
                finalPrice: finalPrice,
                discountPercent: discountPct,
                totalQty: 0,
                totalPrice: 0,
                details: []
            };
        }
        
        grouped[key].totalQty += item.quantity;
        grouped[key].totalPrice += (item.quantity * PIECES_PER_UNIT * item.price);
        grouped[key].details.push(`${item.quantity * PIECES_PER_UNIT} (${item.product.color})`);
    });
    return Object.values(grouped);
}

type Props = { params: Promise<{ id: string }>; };

export default async function PrintOrderPage(props: Props) {
    const params = await props.params;
    const orderId = params.id;
    const order = await getOrderById(orderId);
    const settings = await prisma.settings.findFirst();

    if (!order) return <div className="p-10 text-center font-bold text-red-600 text-xl">الأوردر غير موجود</div>;

    const groupedItems = groupOrderItems(order.items);
    const totalPieces = order.items.reduce((acc: number, item: any) => acc + (item.quantity * PIECES_PER_UNIT), 0);

    const orderDepositEGP = (order.currency === 'EGP' || !order.currency) ? (order.deposit || 0) : 0;
    
    const collectionPaymentsEGP = order.customer.payments
        ?.filter((p: any) => p.type === 'IN' && (p.currency === 'EGP' || !p.currency))
        .reduce((acc: number, p: any) => acc + p.amount, 0) || 0;

    const foreignPayments = order.customer.payments
        ?.filter((p: any) => p.type === 'IN' && p.currency !== 'EGP' && p.currency) || [];

    const totalAmount = order.totalAmount; 
    const totalPaidEGP = orderDepositEGP + collectionPaymentsEGP; 
    const remainingEGP = totalAmount - totalPaidEGP;

    const totalDiscountValue = groupedItems.reduce((acc: number, item: any) => {
        const totalOriginal = item.originalPrice * (item.totalQty * PIECES_PER_UNIT);
        const totalFinal = item.finalPrice * (item.totalQty * PIECES_PER_UNIT);
        return acc + (totalOriginal - totalFinal);
    }, 0);

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans print:bg-white print:p-0">
            <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap gap-4 print:hidden" dir="rtl">
                <PrintButton />
                <NewOrderButton />
                <HomeButton />
            </div>

            <div id="invoice-content" className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full print:max-w-none px-6 pt-[4.5cm] md:px-10" dir="rtl">
                
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-8 print:border-gray-300">
                    <table className="w-full text-base text-black">
                        <tbody>
                            <tr>
                                <td className="font-bold whitespace-nowrap">العميل:</td>
                                <td className="px-2">{order.customer.name}</td>
                                <td className="font-bold whitespace-nowrap">الهاتف:</td>
                                <td className="px-2 font-mono">
                                    {order.customer.phone || '-'}
                                    {order.customer.phone2 && ` / ${order.customer.phone2}`}
                                </td>
                                <td className="font-bold whitespace-nowrap">العنوان:</td>
                                <td className="px-2">{order.customer.address || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-black min-w-[600px] md:min-w-0">
                        <thead>
                            <tr className="bg-gray-200 text-black text-sm font-bold print:bg-gray-300">
                                <th className="p-3 border border-black w-12">م</th>
                                <th className="p-3 border border-black w-24">الموديل</th>
                                <th className="p-3 border border-black text-right">التفاصيل</th>
                                <th className="p-3 border border-black w-24">العدد</th>
                                <th className="p-3 border border-black w-24">السعر</th>
                                <th className="p-3 border border-black w-20">خصم %</th>
                                <th className="p-3 border border-black w-32">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedItems.map((item: any, idx: number) => (
                                <tr key={idx} className="text-xs border-b border-black text-black">
                                    <td className="p-3 border-x border-black text-center">{idx + 1}</td>
                                    <td className="p-3 border-x border-black text-center font-bold">{item.modelNo}</td>
                                    <td className="p-3 border-x border-black">
                                        <div className="font-bold">{item.desc} <span className="text-xs text-gray-600">({item.details.join(' + ')})</span></div>
                                    </td>
                                    <td className="p-3 border-x border-black text-center font-bold">{item.totalQty * 4}</td>
                                    <td className="p-3 border-x border-black text-center">
                                        {item.discountPercent > 0 ? (
                                            <>
                                                <div className="line-through text-gray-400 text-xs">{item.originalPrice.toFixed(2)}</div>
                                                <div className="font-bold">{item.finalPrice.toFixed(2)}</div>
                                            </>
                                        ) : (
                                            item.finalPrice.toFixed(2)
                                        )}
                                    </td>
                                    <td className="p-3 border-x border-black text-center font-bold">
                                        {item.discountPercent > 0 ? <span className="bg-black text-white px-2 py-1 rounded text-xs">{item.discountPercent}%</span> : '-'}
                                    </td>
                                    <td className="p-3 border-x border-black text-center font-bold">{item.totalPrice.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                           <tr>
                                <td colSpan={7} className="p-0 border-none">
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 h-fit break-inside-avoid mt-8">
                                        <h3 className="font-bold text-sm mb-3 text-blue-800 border-b pb-1">سجل تحصيلات العملات (إحاطة):</h3>
                                        {foreignPayments.length > 0 ? (
                                            <div className="space-y-2">
                                                {foreignPayments.map((p: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-xs border-b border-gray-200 pb-1 text-black">
                                                        <span>سند قبض #{p.receiptNo}</span>
                                                        <span className="font-bold">{p.amount} {p.currency}</span>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] text-red-500 mt-2 font-bold">* تنبيه: هذه المبالغ لم تُخصم من الصافي لعدم توفر سعر صرف آلي.</p>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400">لا توجد تحصيلات بالعملة الأجنبية.</p>
                                        )}
                                    </div>

                                    <div className="border-2 border-black rounded-lg overflow-hidden h-fit break-inside-avoid mt-8">
                                        <div className="flex justify-around items-center p-3 border-b border-black bg-gray-100 text-black">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-bold">إجمالي القطع:</span>
                                                <span>{totalPieces} قطعة</span>
                                            </div>
                                            <div className="flex items-center gap-2 font-bold text-base">
                                                <span>صافي الفاتورة:</span>
                                                <span>{totalAmount.toFixed(2)} ج.م</span>
                                            </div>
                                        </div>
                                        
                                        {totalDiscountValue > 0 && (
                                            <div className="flex justify-between p-3 border-b border-black bg-gray-50 text-red-600">
                                                <span className="font-bold">إجمالي الخصم (توفير):</span>
                                                <span className="font-bold">- {totalDiscountValue.toFixed(0)} ج.م</span>
                                            </div>
                                        )}

                                        {totalPaidEGP > 0 && (
                                            <div className="flex justify-between p-3 border-b border-black bg-white font-bold text-gray-700">
                                                <span>إجمالي المسدد (بالجنيه):</span>
                                                <span className="text-red-600">- {totalPaidEGP.toFixed(2)} ج.م</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between p-4 bg-black text-white text-xl md:text-3xl font-bold">
                                            <span>{remainingEGP <= 0 ? 'الرصيد:' : 'المتبقي (ج.م):'}</span>
                                            <span>{remainingEGP.toFixed(2)} ج.م</span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Invoice Notes Section */}
                {(settings?.invoiceNotes || order.notes) && (
                    <div className="mt-8 border-t-2 border-dashed pt-4 break-inside-avoid">
                        <h4 className="font-bold mb-2">ملحوظات:</h4>
                        {settings?.invoiceNotes && (
                            <p className="text-sm whitespace-pre-wrap mb-2 border-b border-gray-200 pb-2">
                                {`البائع: ${order.user.name}. `}{settings.invoiceNotes}
                            </p>
                        )}
                        {order.notes && (
                            <div>
                                <p className="text-xs text-gray-500">ملحوظة خاصة بالفاتورة:</p>
                                <p className="text-sm whitespace-pre-wrap font-bold">{order.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
