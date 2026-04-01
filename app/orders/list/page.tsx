'use client'
import { useEffect, useState, useRef, useCallback } from 'react';
import { getUserOrders, deleteOrder, getSettings } from '@/app/actions';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
// مكتبات الطباعة
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PIECES_PER_UNIT = 4;

// دالة تجميع الأصناف (المحدثة للخصم)
function groupOrderItems(items: any[]) {
    const grouped: any = {};
    items?.forEach(item => {
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

export default function OrdersListPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('EMPLOYEE');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newOrderAlert, setNewOrderAlert] = useState(false); // تنبيه الأوردر الجديد
  const [settings, setSettings] = useState<any>(null);

  // حالات طباعة PDF
  const [pdfOrder, setPdfOrder] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const hiddenInvoiceRef = useRef<HTMLDivElement>(null);

  // لحساب قيمة الخصم الكلية للـ PDF
  const [pdfTotalDiscount, setPdfTotalDiscount] = useState(0);

  // --- دالة جلب البيانات (محدثة لدعم التحديث التلقائي) ---
  const fetchOrdersData = useCallback(async (isRefresh = false) => {
    if (session?.user?.image) {
      const res = await getUserOrders(session.user.image);
      
      // منطق التنبيه: إذا زاد عدد الأوردرات عما هو موجود في الـ State
      if (isRefresh && res.orders.length > orders.length && orders.length > 0) {
        setNewOrderAlert(true);
        setTimeout(() => setNewOrderAlert(false), 6000); // إخفاء التنبيه بعد 6 ثواني
      }

      setOrders(res.orders);
      setUserRole(res.userRole || 'EMPLOYEE');
      if(!isRefresh) setLoading(false);
    }
  }, [session, orders.length]);

  // التحميل الأول للملف
  useEffect(() => {
    fetchOrdersData();
    getSettings().then(setSettings);
  }, [session, fetchOrdersData]);

  // --- إضافة التحديث التلقائي (كل 7 ثواني) ---
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrdersData(true);
    }, 7000); 
    return () => clearInterval(interval);
  }, [fetchOrdersData]);

  // مراقب الطباعة
  useEffect(() => {
    if (pdfOrder && hiddenInvoiceRef.current) {
        // حساب إجمالي الخصم للفاتورة الحالية
        const grouped = groupOrderItems(pdfOrder.items);
        const discountVal = grouped.reduce((acc: number, item: any) => {
            const totalOriginal = item.originalPrice * (item.totalQty * PIECES_PER_UNIT);
            const totalFinal = item.finalPrice * (item.totalQty * PIECES_PER_UNIT);
            return acc + (totalOriginal - totalFinal);
        }, 0);
        setPdfTotalDiscount(discountVal);

        generateAndSharePdf();
    }
  }, [pdfOrder]);

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الأوردر؟')) {
      const result = await deleteOrder(id);
      if (result.success) {
        setOrders(orders.filter(o => o.id !== id));
      } else {
        alert(`فشل حذف الأوردر: ${result.error}`);
      }
    }
  };

  const handlePdfClick = (order: any) => {
      setIsGeneratingPdf(true);
      setPdfOrder(order);
  };

  const generateAndSharePdf = async () => {
      try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const input = hiddenInvoiceRef.current;
          if (!input) return;

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

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = 210;
          const margin = 10;
          const imgProps = pdf.getImageProperties(imgData);
          const contentWidth = pdfWidth - (margin * 2);
          const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

          pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

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
          setPdfOrder(null);
      }
  };

  const filteredOrders = orders.filter(o => 
    o.orderNo.toString().includes(searchTerm) || 
    o.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800 overflow-x-hidden" dir="rtl">
      
      {/* تنبيه الأوردر الجديد العائم */}
      {newOrderAlert && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-3">
              <span className="text-xl">🔔</span>
              <span>وصل أوردر جديد الآن! يتم التحديث...</span>
          </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 shadow mb-4 sticky top-0 z-20 flex justify-between items-center">
        <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            📋 سجل الأوردرات
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        </h2>
        <Link href="/" className="bg-gray-100 px-4 py-2 rounded font-bold text-sm">عودة 🏠</Link>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Search */}
        <input 
            type="text" 
            placeholder="🔍 ابحث برقم الأوردر أو اسم العميل..." 
            className="w-full p-3 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
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

        {/* Orders List */}
        <div className="space-y-4">
            {filteredOrders.length === 0 && <div className="text-center text-gray-500 mt-10">لا توجد أوردرات</div>}
            
            {filteredOrders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all transform hover:scale-[1.01]">
                    <div className="flex justify-between items-start border-b pb-2 mb-2">
                        <div>
                            <div className="font-bold text-lg text-blue-800">#{order.orderNo}</div>
                            <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('ar-EG')} - {new Date(order.createdAt).toLocaleTimeString('ar-EG')}</div>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-lg">{order.totalAmount.toFixed(0)} ج.م</div>
                            
                            {/* 👇 التعديل المطلوب: تكبير وتلوين العربون 👇 */}
                            {order.deposit > 0 ? (
                                <div className="mt-1">
                                    <span className="text-xl font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200 inline-block animate-pulse shadow-sm">
                                        عربون: {order.deposit.toFixed(0)} ج.م 🔥
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[10px] bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold">آجل بالكامل</span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <div className="font-bold text-gray-700">👤 {order.customer.name}</div>
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">بواسطة: {order.user.name}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <Link href={`/orders/${order.id}/print`} className="bg-blue-100 text-blue-700 py-2 rounded-lg text-center font-bold text-xs md:text-sm hover:bg-blue-200 flex items-center justify-center">
                            🖨️ طباعة
                        </Link>
                        
                        <button 
                            onClick={() => handlePdfClick(order)}
                            disabled={isGeneratingPdf}
                            className="bg-green-100 text-green-700 py-2 rounded-lg text-center font-bold text-xs md:text-sm hover:bg-green-200 flex items-center justify-center gap-1"
                        >
                            📤 PDF
                        </button>

                        <Link href={`/orders/${order.id}/edit`} className="bg-yellow-100 text-yellow-700 py-2 rounded-lg text-center font-bold text-xs md:text-sm hover:bg-yellow-200 flex items-center justify-center">
                            تعديل ✏️
                        </Link>
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
          HIDDEN INVOICE SECTION (تم الحفاظ عليه بالكامل كما في كودك الأصلي)
         ========================================================================= */}
      <div style={{ position: 'fixed', top: 0, left: '-10000px', width: '210mm', zIndex: -100, visibility: 'hidden' }}>
         <div id="hidden-invoice-content" ref={hiddenInvoiceRef} className="bg-white p-10 text-right" style={{ width: '210mm', minHeight: '297mm', direction: 'rtl', visibility: 'visible' }}>
            {pdfOrder && (
                <>
                    <header className="border-b-4 border-black pb-4 mb-6 grid grid-cols-3 items-start">
                        <div className="text-left">
                            <div className="text-md font-bold text-black">رقم: #{pdfOrder.orderNo}</div>
                            <div className="text-sm text-gray-500">{new Date(pdfOrder.createdAt).toLocaleDateString('ar-EG')}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg md:text-xl font-bold bg-black text-white px-4 py-1 inline-block rounded">فاتورة مبيعات</div>
                        </div>
                        <div className="text-right">
                            <h1 className="text-xl md:text-2xl font-bold text-black">{settings?.siteName || "اسم المعرض"}</h1>
                        </div>
                    </header>

                    {/* Dynamic Header from Settings */}
                    {settings?.header && (
                        <div className="prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: settings.header }}></div>
                    )}

                    <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-8 print:border-gray-300">
                        <table className="w-full text-base text-black">
                            <tbody>
                                <tr>
                                    <td className="font-bold whitespace-nowrap">العميل:</td>
                                    <td className="px-2">{pdfOrder.customer.name}</td>
                                    <td className="font-bold whitespace-nowrap">الهاتف:</td>
                                    <td className="px-2 font-mono">
                                        {pdfOrder.customer.phone || '-'}
                                        {pdfOrder.customer.phone2 && ` / ${pdfOrder.customer.phone2}`}
                                    </td>
                                    <td className="font-bold whitespace-nowrap">العنوان:</td>
                                    <td className="px-2">{pdfOrder.customer.address || '-'}</td>
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
                                <th className="p-3 border border-black w-20">خصم</th>
                                <th className="p-3 border border-black w-32">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupOrderItems(pdfOrder.items).map((item: any, idx: number) => (
                                <tr key={idx} className="text-sm border-b border-black">
                                    <td className="p-3 border-x border-black text-center font-bold text-lg text-black">{item.modelNo}</td>
                                    <td className="p-3 border-x border-black">
                                        <div className="font-bold text-black">{item.desc} <span className="text-xs text-gray-600">({item.details.join(' + ')})</span></div>
                                    </td>
                                    <td className="p-3 border-x border-black text-center text-lg font-bold text-black">{item.totalQty * 4}</td>
                                    
                                    {/* السعر */}
                                    <td className="p-3 border-x border-black text-center text-black">
                                        {item.discountPercent > 0 ? (
                                            <>
                                                <div className="line-through text-gray-400 text-xs">{item.originalPrice.toFixed(2)}</div>
                                                <div className="font-bold">{item.finalPrice.toFixed(2)}</div>
                                            </>
                                        ) : (
                                            item.finalPrice.toFixed(2)
                                        )}
                                    </td>

                                    {/* الخصم */}
                                    <td className="p-3 border-x border-black text-center font-bold text-black">
                                        {item.discountPercent > 0 ? (
                                            <span className="bg-black text-white px-2 py-1 rounded text-xs">
                                                {item.discountPercent}%
                                            </span>
                                        ) : '-'}
                                    </td>

                                    <td className="p-3 border-x border-black text-center font-bold text-lg text-black">{item.totalPrice.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex justify-end mb-16">
                        <div className="w-1/2 border-2 border-black rounded-lg overflow-hidden">
                            
                            {/* إجمالي الخصم في الفوتر */}
                            {pdfTotalDiscount > 0 && (
                                <div className="flex justify-between p-3 border-b border-black bg-gray-50 text-red-600">
                                    <span className="font-bold">إجمالي الخصم:</span>
                                    <span className="font-bold">- {pdfTotalDiscount.toFixed(0)} ج.م</span>
                                </div>
                            )}

                            <div className="flex justify-between p-3 border-b border-black bg-gray-100 font-bold text-lg text-black">
                                <span>صافي الفاتورة:</span>
                                <span>{pdfOrder.totalAmount.toFixed(2)} ج.م</span>
                            </div>
                            {pdfOrder.deposit > 0 && (
                                <div className="flex justify-between p-3 border-b border-black bg-white font-bold text-gray-700">
                                    <span>مدفوع:</span>
                                    <span className="text-red-600">- {pdfOrder.deposit.toFixed(2)} ج.م</span>
                                </div>
                            )}
                            <div className="flex justify-between p-4 bg-black text-white text-3xl font-bold">
                                <span>{pdfOrder.deposit > 0 ? 'المتبقي:' : 'المطلوب:'}</span>
                                <span>{(pdfOrder.totalAmount - pdfOrder.deposit).toFixed(2)} ج.م</span>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Footer from Settings */}
                    {settings?.footer && (
                        <div className="prose prose-sm max-w-none mt-4 text-center" dangerouslySetInnerHTML={{ __html: settings.footer }}></div>
                    )}
                </>
            )}
         </div>
      </div>
    </div>
  );
}