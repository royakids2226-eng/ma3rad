'use client'

import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  customerName: string;
  orderNo: number;
  phone: string | null;
}

export default function SharePdfButton({ customerName, orderNo, phone }: Props) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    // التحقق من وجود العنصر في الصفحة
    const input = document.getElementById('invoice-content');
    if (!input) {
        alert("عنصر الفاتورة غير موجود! يرجى إعادة تحميل الصفحة.");
        return;
    }

    setLoading(true);
    try {
      // 1. تحسين جودة التقاط الصورة وتجنب مشاكل التقطيع
      const canvas = await html2canvas(input, {
        scale: 2, // مقياس 2 يعتبر متوازن جداً بين الجودة والأداء
        useCORS: true, // ضروري لتحميل أي خطوط أو صور خارجية إن وجدت
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        // دالة يتم استدعاؤها على النسخة المستنسخة من الـ DOM قبل التصوير
        onclone: (documentClone) => {
            const element = documentClone.getElementById('invoice-content');
            if (element) {
                // ضبط العرض ليناسب ورقة A4 بشكل مثالي
                element.style.width = '210mm'; 
                element.style.padding = '0';   
                element.style.backgroundColor = '#ffffff';
                element.style.color = '#000000';
            }
        }
      });

      // 2. إعداد بيانات الصورة للـ PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.9); // جودة 0.9 كافية جداً وتققل الحجم
      
      // 3. إنشاء ملف PDF بمقاس A4
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;  // عرض A4
      const pdfHeight = 297; // طول A4
      const margin = 5;      // هامش صغير 5مم

      // حساب الأبعاد النسبية للصورة للحفاظ على تناسب الطول والعرض
      const imgProps = pdf.getImageProperties(imgData);
      const contentWidth = pdfWidth - (margin * 2); 
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      // إضافة الصورة للـ PDF
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

      // 4. تجهيز اسم الملف
      const fileName = `Invoice_${orderNo}_${customerName.replace(/\s+/g, '_')}.pdf`;

      // 5. محاولة المشاركة عبر Web Share API (للموبايل)
      try {
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `فاتورة رقم ${orderNo}`,
              text: `مرفق فاتورة العميل: ${customerName} - رقم ${orderNo}`,
            });
          } else {
            // fallback للكمبيوتر أو المتصفحات التي لا تدعم المشاركة
            throw new Error("Sharing not supported");
          }
      } catch (shareError) {
          // إذا فشلت المشاركة (أو كنا على ديسكتوب)، نقوم بالتنزيل المباشر
          pdf.save(fileName);
          console.log("تم التنزيل بدلاً من المشاركة:", shareError);
      }

    } catch (error: any) {
      console.error("Error generating PDF:", error);
      // رسالة خطأ أكثر وضوحاً للمستخدم
      alert("حدث خطأ غير متوقع أثناء إنشاء ملف الـ PDF. \n" + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <button
        onClick={handleShare}
        disabled={loading}
        className={`bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2 justify-center transition-all ${loading ? 'opacity-50 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
      >
        <span className="text-xl">📄</span>
        {loading ? 'جاري المعالجة والتحميل...' : 'حفظ / مشاركة فاتورة PDF'}
      </button>
      
      {/* نص مساعد يظهر أسفل الزر */}
      <p className="text-[11px] text-gray-500 text-center max-w-[250px] mx-auto leading-tight">
        * سيتم فتح نافذة المشاركة (واتساب وغيرها) على الموبايل، أو التحميل المباشر على الكمبيوتر.
      </p>
    </div>
  );
}