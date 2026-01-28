'use client'

import { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  customerName: string;
  orderNo: number;
  phone: string | null;
}

export default function SharePdfButton({ customerName, orderNo, phone }: Props) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    const input = document.getElementById('invoice-content'); // 👈 العنصر المراد طباعته
    if (!input) return;

    setLoading(true);
    try {
      // 1. تحويل التصميم إلى صورة عالية الجودة
      const canvas = await html2canvas(input, {
        scale: 2, // جودة أعلى
        useCORS: true,
        logging: false,
      });

      // 2. إعداد ملف PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // 3. تحويل الـ PDF إلى ملف جاهز للمشاركة
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Invoice_${orderNo}.pdf`, { type: 'application/pdf' });

      // 4. محاولة المشاركة عبر واجهة الهاتف
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `فاتورة رقم ${orderNo}`,
          text: `مرحباً ${customerName}، مرفق فاتورة طلبك.`,
        });
      } else {
        // 5. البديل للكمبيوتر: تحميل الملف وفتح واتساب ويب
        pdf.save(`Invoice_${orderNo}.pdf`);
        
        if (phone) {
            const waUrl = `https://wa.me/20${phone}?text=${encodeURIComponent('مرفق الفاتورة التي تم تحميلها...')}`;
            window.open(waUrl, '_blank');
        } else {
            alert("تم تحميل ملف PDF على جهازك.");
        }
      }

    } catch (error) {
      console.error("Error generating PDF", error);
      alert("حدث خطأ أثناء إنشاء الملف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className={`bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? 'جاري التجهيز...' : '📤 إرسال PDF واتساب'}
    </button>
  );
}