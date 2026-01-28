'use client'
import { useEffect, useState, useRef } from 'react';
import { getUserOrders, deleteOrder } from '@/app/actions';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
// مكتبات الطباعة
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// دالة تجميع الأصناف (نفس المستخدمة في الطباعة)
function groupOrderItems(items: any[]) {
    const grouped: any = {};
    items?.forEach(item => {
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

export default function OrdersListPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('EMPLOYEE');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // حالات طباعة PDF
  const [pdfOrder, setPdfOrder] = useState<any>(null); // الأوردر الجاري طباعته
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const hiddenInvoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.user?.image) {
      getUserOrders(session.user.image).then(res => {
        setOrders(res.orders);
        setUserRole(res.userRole);
        setLoading(false);
      });
    }
  }, [session]);

  // 🔄 مراقب لعملية الطباعة: بمجرد وضع أوردر في pdfOrder، نقوم بتصويره
  useEffect(() => {
    if (pdfOrder && hiddenInvoiceRef.current) {
        generateAndSharePdf();
    }
  }, [pdfOrder]);

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الأوردر؟')) {
      await deleteOrder(id);
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  // دالة بدء عملية الـ PDF
  const handlePdfClick = (order: any) => {
      setIsGeneratingPdf(true);
      setPdfOrder(order); // هذا سيقوم بتحديث الفاتورة المخفية وتشغيل الـ useEffect
  };

  const generateAndSharePdf = async () => {
      try {
          // انتظار بسيط لضمان تحديث الـ DOM بالبيانات الجديدة
          await new Promise(resolve => setTimeout(resolve, 500));

          const input = hiddenInvoiceRef.current;
          if (!input) return;

          // 1. التقاط الصورة (نفس كود SharePdfButton)
          const canvas = await html2canvas(input, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              onclone: (doc) => {
                  const el = doc.getElementById('hidden-invoice-content');
                  if (el) {
                      el.style.width = '210mm';
                      el.style.backgroundColor = '#ffffff';
                      el.style.color = '#000000';
                  }
              }
          });

          // 2. إعداد PDF
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = 210;
          const pdfHeight = 297;
          const margin = 10;
          const imgProps = pdf.getImageProperties(imgData);
          const contentWidth = pdfWidth - (margin * 2);
          const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

          pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

          // 3. المشاركة
          const fileName = `Invoice_${pdfOrder.orderNo}.pdf`;
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: `فاتورة #${pdfOrder.orderNo}`,
                  text: `مرحباً ${pdfOrder.customer.name}، مرفق فاتورة طلبك.`,
              });
          } else {
              pdf.save(fileName);
              if (pdfOrder.customer.phone) {
                  const waUrl = `https://wa.me/20${pdfOrder.customer.phone}?text=${encodeURIComponent('مرفق الفاتورة (يرجى سحب الملف المحمل)...')}`;
                  window.open(waUrl, '_blank');
              } else {
                  alert("تم تحميل الملف.");
              }
          }
      } catch (e) {
          console.error(e);
          alert("حدث خطأ أثناء إنشاء الملف");
      } finally {
          setIsGeneratingPdf(false);
          setPdfOrder(null); // تنظيف
      }
  };

  const filteredOrders = orders.filter(o => 
    o.orderNo.toString().includes(searchTerm) || 
    o.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800" dir="rtl">
      
      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center">
        <h2 className="font-bold text-lg text-gray-800">📋 سجل الأوردرات</h2>
        <Link href="/" className="bg-gray-100 px-4 py-2 rounded font-bold text-sm">عودة 🏠</Link>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Search */}
        <input 
            type="text" 
            placeholder="🔍 ابحث برقم الأوردر أو اسم العميل..." 
            className="w-full p-3 border rounded-lg bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Overlay Loading */}
        {isGeneratingPdf && (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex flex-col justify-center items-center text-white">
                <div className="text-2xl font-bold animate-pulse">⏳ جاري إنشاء ملف PDF...</div>
                <p className="text-sm mt-2">يرجى الانتظار واختيار العميل من الواتساب</p>
            </div>
        )}

        {/* Orders List (Responsive) */}
        <div className="space-y-4">
            {filteredOrders.length === 0 && <div className="text-center text-gray-500 mt-10">لا توجد أوردرات</div>}
            
            {filteredOrders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-start border-b pb-2 mb-2">
                        <div>
                            <div className="font-bold text-lg text-blue-800">#{order.orderNo}</div>
                            <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('ar-EG')} - {new Date(order.createdAt).toLocaleTimeString('ar-EG')}</div>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-lg">{order.totalAmount.toFixed(0)} ج.م</div>
                            {order.deposit > 0 ? (
                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">عربون: {order.deposit}</span>
                            ) : (
                                <span className="text-[10px] bg-red-100 text-red-800 px-2 py-1 rounded-full">آجل بالكامل</span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <div className="font-bold text-gray-700">👤 {order.customer.name}</div>
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">بواسطة: {order.user.name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {/* زر الطباعة العادي */}
                        <Link href={`/orders/${order.id}/print`} className="bg-blue-100 text-blue-700 py-2 rounded-lg text-center font-bold text-sm hover:bg-blue-200">
                            🖨️ طباعة
                        </Link>
                        
                        {/* زر واتساب PDF الجديد */}
                        <button 
                            onClick={() => handlePdfClick(order)}
                            disabled={isGeneratingPdf}
                            className="bg-green-100 text-green-700 py-2 rounded-lg text-center font-bold text-sm hover:bg-green-200 flex items-center justify-center gap-1"
                        >
                            📤 PDF واتساب
                        </button>
                    </div>

                    {(userRole === 'ADMIN' || userRole === 'OWNER') && (
                        <button onClick={() => handleDelete(order.id)} className="w-full mt-2 text-red-500 text-xs font-bold py-2 border border-red-100 rounded hover:bg-red-50">
                            حذف الأوردر ❌
                        </button>
                    )}
                </div>
            ))}
        </div>
      </div>

      {/* =========================================================================
          HIDDEN INVOICE SECTION (Used for generating PDF)
          This is invisible to the user but visible to html2canvas
         ========================================================================= */}
      <div style={{ position: 'absolute', top: 0, left: '-10000px', width: '210mm' }}>
         <div id="hidden-invoice-content" ref={hiddenInvoiceRef} className="bg-white p-10 text-right" style={{ width: '210mm', minHeight: '297mm', direction: 'rtl' }}>
            {pdfOrder && (
                <>
                    <header className="border-b-4 border-black pb-6 mb-6 flex justify-between items-start">
                        <div>
                            <h1 className="text-4xl font-extrabold mb-2">مصنع الملابس الجاهزة</h1>
                            <p className="text-gray-600 text-lg">إدارة المبيعات</p>
                        </div>
                        <div className="text-left">
                            <div className="text-2xl font-bold bg-black text-white px-4 py-1 mb-2 inline-block rounded">فاتورة مبيعات</div>
                            <div className="text-lg font-bold">رقم: #{pdfOrder.orderNo}</div>
                            <div className="text-sm text-gray-500">{new Date(pdfOrder.createdAt).toLocaleDateString('ar-EG')}</div>
                        </div>
                    </header>

                    <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-8">
                        <table className="w-full text-base">
                            <tbody>
                                <tr>
                                    <td className="font-bold w-24 py-2">العميل:</td>
                                    <td className="text-xl">{pdfOrder.customer.name}</td>
                                    <td className="font-bold w-24 pl-4">الهاتف:</td>
                                    <td>
                                        <div>{pdfOrder.customer.phone || '-'}</div>
                                        {pdfOrder.customer.phone2 && <div>{pdfOrder.customer.phone2}</div>}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="font-bold py-2">العنوان:</td>
                                    <td colSpan={3}>{pdfOrder.customer.address || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <table className="w-full mb-8 border-collapse border border-black">
                        <thead>
                            <tr className="bg-gray-200 text-black text-sm font-bold">
                                <th className="p-3 border border-black w-24">الموديل</th>
                                <th className="p-3 border border-black text-right">التفاصيل</th>
                                <th className="p-3 border border-black w-24">العدد</th>
                                <th className="p-3 border border-black w-24">السعر</th>
                                <th className="p-3 border border-black w-32">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupOrderItems(pdfOrder.items).map((item: any, idx: number) => (
                                <tr key={idx} className="text-sm border-b border-black">
                                    <td className="p-3 border-x border-black text-center font-bold text-lg">{item.modelNo}</td>
                                    <td className="p-3 border-x border-black">
                                        <div className="font-bold mb-1">{item.desc}</div>
                                        <div className="text-xs text-gray-600">{item.details.join(' + ')}</div>
                                    </td>
                                    <td className="p-3 border-x border-black text-center text-lg font-bold">{item.totalQty * 4}</td>
                                    <td className="p-3 border-x border-black text-center">{item.price}</td>
                                    <td className="p-3 border-x border-black text-center font-bold text-lg">{item.totalPrice.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex justify-end mb-16">
                        <div className="w-1/2 border-2 border-black rounded-lg overflow-hidden">
                            <div className="flex justify-between p-3 border-b border-black bg-gray-100 font-bold text-lg">
                                <span>الإجمالي:</span>
                                <span>{pdfOrder.totalAmount.toFixed(2)} ج.م</span>
                            </div>
                            {pdfOrder.deposit > 0 && (
                                <div className="flex justify-between p-3 border-b border-black bg-white font-bold text-gray-700">
                                    <span>مدفوع:</span>
                                    <span>- {pdfOrder.deposit.toFixed(2)} ج.م</span>
                                </div>
                            )}
                            <div className="flex justify-between p-4 bg-black text-white text-3xl font-bold">
                                <span>{pdfOrder.deposit > 0 ? 'المتبقي:' : 'المطلوب:'}</span>
                                <span>{(pdfOrder.totalAmount - pdfOrder.deposit).toFixed(2)} ج.م</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
         </div>
      </div>
    </div>
  );
}