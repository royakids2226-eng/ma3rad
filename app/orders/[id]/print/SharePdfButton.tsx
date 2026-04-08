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
        alert("عنصر الفاتورة غير موجود! يرجى إعادة تحميل الصفحة.");
        return;
    }

    setLoading(true);
    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 5;

      const imgProps = pdf.getImageProperties(imgData);
      const contentWidth = pdfWidth - (margin * 2); 
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

      const fileName = `Invoice_${orderNo}_${customerName.replace(/\s+/g, '_')}.pdf`;

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
            throw new Error("Sharing not supported");
          }
      } catch (shareError) {
          pdf.save(fileName);
          console.log("تم التنزيل بدلاً من المشاركة:", shareError);
      }

    } catch (error: any) {
      console.error("Error generating PDF:", error);
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
      
      <p className="text-[11px] text-gray-500 text-center max-w-[250px] mx-auto leading-tight">
        * سيتم فتح نافذة المشاركة (واتساب وغيرها) على الموبايل، أو التحميل المباشر على الكمبيوتر.
      </p>
    </div>
  );
}