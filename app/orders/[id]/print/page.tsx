import { getOrderById } from "@/app/actions";
import PrintButton from "./PrintButton";

function groupOrderItems(items: any[]) {
    const grouped: any = {};
    items.forEach(item => {
        const modelNo = item.product.modelNo;
        if (!grouped[modelNo]) {
            grouped[modelNo] = {
                modelNo, desc: item.product.description, price: item.price,
                totalPrice: 0, totalQty: 0, details: []
            };
        }
        grouped[modelNo].totalQty += item.quantity;
        grouped[modelNo].totalPrice += (item.quantity * 4 * item.price);
        grouped[modelNo].details.push(`${item.quantity * 4} (${item.product.color})`);
    });
    return Object.values(grouped);
}

type Props = { params: Promise<{ id: string }>; };

export default async function PrintOrderPage(props: Props) {
    const params = await props.params;
    const orderId = params.id;
    const order = await getOrderById(orderId);

    if (!order) return <div className="p-10 text-center font-bold text-red-600 text-xl">الأوردر غير موجود</div>;

    const groupedItems = groupOrderItems(order.items);
    const totalPieces = order.items.reduce((acc: number, item: any) => acc + (item.quantity * 4), 0);
    const deposit = order.deposit || 0;
    const remaining = order.totalAmount - deposit;

    const whatsappLink = order.customer.phone 
        ? `https://wa.me/20${order.customer.phone}?text=${encodeURIComponent(
            `فاتورة #${order.orderNo}\nالمطلوب: ${remaining} ج.م`
          )}`
        : null;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans print:bg-white print:p-0">
            <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap gap-4 print:hidden" dir="rtl">
                <PrintButton />
                {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2">
                        إرسال واتس 📱
                    </a>
                )}
                <a href="/" className="bg-gray-500 text-white px-6 py-3 rounded-lg font-bold flex items-center">🏠 خروج</a>
            </div>

            <div className="max-w-[210mm] mx-auto bg-white p-6 md:p-10 shadow-2xl print:shadow-none print:w-full print:max-w-none" dir="rtl">
                <header className="border-b-4 border-black pb-6 mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">مصنع الملابس الجاهزة</h1>
                        <p className="text-gray-600 text-lg">إدارة المبيعات والتوزيع</p>
                    </div>
                    <div className="text-right md:text-left w-full md:w-auto">
                        <div className="text-xl md:text-2xl font-bold bg-black text-white px-4 py-1 mb-2 inline-block rounded">فاتورة مبيعات</div>
                        <div className="text-lg font-bold">رقم: #{order.orderNo}</div>
                        <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</div>
                    </div>
                </header>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-8 print:border-gray-300">
                    <table className="w-full text-base">
                        <tbody>
                            <tr>
                                <td className="font-bold w-20 md:w-24 py-2 align-top">العميل:</td>
                                <td className="text-lg md:text-xl align-top">{order.customer.name}</td>
                                <td className="font-bold w-20 md:w-24 text-left pl-4 align-top">الهاتف:</td>
                                <td className="align-top font-mono">
                                    {/* 👇 عرض الهاتفين */}
                                    <div>{order.customer.phone || '-'}</div>
                                    {order.customer.phone2 && <div>{order.customer.phone2}</div>}
                                </td>
                            </tr>
                            <tr>
                                <td className="font-bold py-2 align-top">العنوان:</td>
                                <td colSpan={3} className="text-gray-700 align-top">{order.customer.address || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full mb-8 border-collapse border border-black min-w-[600px] md:min-w-0">
                        <thead>
                            <tr className="bg-gray-200 text-black text-sm font-bold print:bg-gray-300">
                                <th className="p-3 border border-black w-24">الموديل</th>
                                <th className="p-3 border border-black text-right">الألوان (بالقطعة)</th>
                                <th className="p-3 border border-black w-24">العدد (قطعة)</th>
                                <th className="p-3 border border-black w-24">سعر القطعة</th>
                                <th className="p-3 border border-black w-32">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedItems.map((item: any, idx: number) => (
                                <tr key={idx} className="text-sm border-b border-black">
                                    <td className="p-3 border-x border-black text-center font-bold text-lg">{item.modelNo}</td>
                                    <td className="p-3 border-x border-black">
                                        <div className="font-bold mb-1">{item.desc}</div>
                                        <div className="text-xs text-gray-600 leading-relaxed">{item.details.join(' + ')}</div>
                                    </td>
                                    <td className="p-3 border-x border-black text-center text-lg font-bold">{item.totalQty * 4}</td>
                                    <td className="p-3 border-x border-black text-center">{item.price}</td>
                                    <td className="p-3 border-x border-black text-center font-bold text-lg">{item.totalPrice.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end mb-16">
                    <div className="w-full md:w-1/2 border-2 border-black rounded-lg overflow-hidden">
                        <div className="flex justify-between p-3 border-b border-black bg-gray-50">
                            <span className="font-bold">إجمالي القطع:</span>
                            <span>{totalPieces} قطعة</span>
                        </div>
                        <div className="flex justify-between p-3 border-b border-black bg-gray-100 font-bold text-lg">
                            <span>إجمالي الفاتورة:</span>
                            <span>{order.totalAmount.toFixed(2)} ج.م</span>
                        </div>
                        {deposit > 0 && (
                            <div className="flex justify-between p-3 border-b border-black bg-white font-bold text-gray-700">
                                <span>مدفوع (عربون):</span>
                                <span>- {deposit.toFixed(2)} ج.م</span>
                            </div>
                        )}
                        <div className="flex justify-between p-4 bg-black text-white text-xl md:text-3xl font-bold">
                            <span>{deposit > 0 ? 'المتبقي:' : 'المطلوب دفعه:'}</span>
                            <span>{remaining.toFixed(2)} ج.م</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between text-center mt-12 pt-8 border-t border-gray-400 print:mt-20">
                    <div className="w-1/3">
                        <p className="font-bold mb-12">توقيع المستلم</p>
                        <p className="border-t border-black w-3/4 mx-auto"></p>
                    </div>
                    <div className="w-1/3">
                        <p className="font-bold mb-12">أمين المخزن / المبيعات</p>
                        <p className="font-mono">{order.user.name}</p>
                        <p className="border-t border-black w-3/4 mx-auto mt-2"></p>
                    </div>
                </div>
            </div>
        </div>
    );
}