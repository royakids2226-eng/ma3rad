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
    const input = document.getElementById('invoice-content');
    if (!input) {
        alert("عنصر الفاتورة غير موجود!");
        return;
    }

    setLoading(true);
    try {
      // 1. تحسين جودة التقاط الصورة
      const canvas = await html2canvas(input, {
        scale: 3, // رفعنا الدقة لـ 3 أضعاف لتكون الكتابة واضحة
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (documentClone) => {
            const element = documentClone.getElementById('invoice-content');
            if (element) {
                // إجبار الفاتورة على العرض الكامل وتنسيق الألوان
                element.style.width = '210mm'; // عرض A4 ثابت
                element.style.padding = '0';   // إزالة الحواف الداخلية للعنصر نفسه
                element.style.backgroundColor = '#ffffff';
                element.style.color = '#000000';
            }
        }
      });

      // 2. إعداد ملف PDF بمقاس A4 وهوامش
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;  // عرض ورقة A4
      const pdfHeight = 297; // طول ورقة A4
      const margin = 10;     // هامش 1 سم من كل اتجاه

      // حساب أبعاد الصورة لتناسب عرض الصفحة مع ترك هوامش
      const imgProps = pdf.getImageProperties(imgData);
      const contentWidth = pdfWidth - (margin * 2); // العرض المتاح للكتابة
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      // إضافة الصورة في المنتصف مع الهوامش
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

      // 3. تجهيز الملف
      const fileName = `Invoice_${orderNo}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // 4. المشاركة
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `فاتورة رقم ${orderNo}`,
          text: `فاتورة ${customerName} - رقم ${orderNo}`,
        });
        // ملاحظة: هنا يختار المستخدم الشخص من الواتساب يدوياً (قيد تقني عالمي)
      } else {
        // للكمبيوتر
        pdf.save(fileName);
        alert("تم تحميل ملف PDF. يرجى إرساله للعميل يدوياً (لا يدعم المتصفح المشاركة المباشرة هنا).");
      }

    } catch (error: any) {
      console.error("Error:", error);
      alert("حدث خطأ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleShare}
        disabled={loading}
        className={`bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2 justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? '⏳ جاري إنشاء الملف...' : '📄 مشاركة ملف PDF'}
      </button>
      
      {/* نص توضيحي للمستخدم */}
      <p className="text-[10px] text-gray-500 text-center max-w-[200px]">
        سيتم إنشاء ملف PDF وفتح الواتساب. يرجى اختيار العميل <b>{customerName}</b> من القائمة لإرسال الملف له.
      </p>
    </div>
  );
}