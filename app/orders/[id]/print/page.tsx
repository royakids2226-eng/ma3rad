import { getOrderById } from "@/app/actions";
import PrintButton from "./PrintButton";

// دالة تجميع الأصناف للعرض في الفاتورة
function groupOrderItems(items: any[]) {
    const grouped: any = {};
    
    items.forEach(item => {
        const modelNo = item.product.modelNo;
        
        if (!grouped[modelNo]) {
            grouped[modelNo] = {
                modelNo,
                desc: item.product.description,
                price: item.price,
                totalPrice: 0,
                totalQty: 0, // هذا يخزن عدد الدست مؤقتاً
                details: []
            };
        }
        
        grouped[modelNo].totalQty += item.quantity;
        
        // معادلة السعر: الكمية * 4 قطع * السعر
        grouped[modelNo].totalPrice += (item.quantity * 4 * item.price);
        
        // تفاصيل الألوان (مع تحويل العدد لقطع بالضرب في 4)
        grouped[modelNo].details.push(`${item.quantity * 4} (${item.product.color})`);
    });

    return Object.values(grouped);
}

// تعريف نوع البيانات (Next.js 15)
type Props = {
    params: Promise<{ id: string }>;
};

export default async function PrintOrderPage(props: Props) {
    const params = await props.params;
    const orderId = params.id;

    // جلب البيانات من السيرفر
    const order = await getOrderById(orderId);

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="p-10 text-center font-bold text-red-600 text-xl bg-white rounded shadow">
                    عفواً، الأوردر رقم #{orderId} غير موجود
                </div>
            </div>
        );
    }

    const groupedItems = groupOrderItems(order.items);
    
    // حساب إجمالي عدد القطع في الفاتورة
    const totalPieces = order.items.reduce((acc: number, item: any) => acc + (item.quantity * 4), 0);

    // حسابات العربون والمتبقي
    const deposit = order.deposit || 0;
    const remaining = order.totalAmount - deposit;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans print:bg-white print:p-0">
            {/* الأزرار العلوية (تختفي في الطباعة) */}
            <div className="max-w-[210mm] mx-auto mb-6 flex gap-4 print:hidden" dir="rtl">
                <PrintButton />
                
                <a href="/" className="bg-gray-500 text-white px-6 md:px-8 py-3 rounded-lg font-bold hover:bg-gray-600 shadow-lg flex items-center">
                    🏠 خروج
                </a>
            </div>

            {/* ورقة الفاتورة (A4 Layout) */}
            <div className="max-w-[210mm] mx-auto bg-white p-6 md:p-10 shadow-2xl print:shadow-none print:w-full print:max-w-none" dir="rtl">
                
                {/* 1. هيدر الفاتورة */}
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

                {/* 2. بيانات العميل */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-8 print:border-gray-300">
                    <table className="w-full text-base">
                        <tbody>
                            <tr>
                                <td className="font-bold w-20 md:w-24 py-2 align-top">العميل:</td>
                                <td className="text-lg md:text-xl align-top">{order.customer.name}</td>
                                <td className="font-bold w-20 md:w-24 text-left pl-4 align-top">الهاتف:</td>
                                <td className="align-top">{order.customer.phone || '-'}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-2 align-top">العنوان:</td>
                                <td colSpan={3} className="text-gray-700 align-top">{order.customer.address || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. جدول الأصناف (Responsive Wrapper) */}
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
                                        <div className="text-xs text-gray-600 leading-relaxed">
                                            {item.details.join(' + ')}
                                        </div>
                                    </td>
                                    {/* هنا نعرض العدد بالقطعة (دستة × 4) */}
                                    <td className="p-3 border-x border-black text-center text-lg font-bold">
                                        {item.totalQty * 4}
                                    </td>
                                    <td className="p-3 border-x border-black text-center">
                                        {item.price}
                                    </td>
                                    <td className="p-3 border-x border-black text-center font-bold text-lg">
                                        {item.totalPrice.toFixed(0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 4. الإجماليات والفوتر (تم تحسينه للموبايل w-full) */}
                <div className="flex justify-end mb-16">
                    <div className="w-full md:w-1/2 border-2 border-black rounded-lg overflow-hidden">
                        
                        {/* إجمالي القطع */}
                        <div className="flex justify-between p-3 border-b border-black bg-gray-50">
                            <span className="font-bold">إجمالي القطع:</span>
                            <span>{totalPieces} قطعة</span>
                        </div>
                        
                        {/* إجمالي المبلغ */}
                        <div className="flex justify-between p-3 border-b border-black bg-gray-100 font-bold text-lg">
                            <span>إجمالي الفاتورة:</span>
                            <span>{order.totalAmount.toFixed(2)} ج.م</span>
                        </div>
                        
                        {/* العربون (يظهر فقط لو موجود) */}
                        {deposit > 0 && (
                            <div className="flex justify-between p-3 border-b border-black bg-white font-bold text-gray-700">
                                <span>مدفوع (عربون):</span>
                                <span>- {deposit.toFixed(2)} ج.م</span>
                            </div>
                        )}
                        
                        {/* الصافي النهائي */}
                        <div className="flex justify-between p-4 bg-black text-white text-xl md:text-3xl font-bold">
                            <span>{deposit > 0 ? 'المتبقي:' : 'المطلوب دفعه:'}</span>
                            <span>{remaining.toFixed(2)} ج.م</span>
                        </div>
                    </div>
                </div>

                {/* 5. التوقيعات */}
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
                
                {/* تذييل صغير */}
                <div className="text-center text-[10px] mt-8 text-gray-400 print:hidden">
                    رقم مرجعي للنظام: {order.id}
                </div>
            </div>
        </div>
    );
}