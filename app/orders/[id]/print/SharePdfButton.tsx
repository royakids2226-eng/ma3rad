'use client'

import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf'; // 👈 تغيير طريقة الاستيراد (مهم جداً)

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
      // 1. التقاط الصورة
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true, // للسماح بتحميل الصور إن وجدت
        logging: false,
        allowTaint: true, // محاولة تجاوز مشاكل التلوين
        backgroundColor: '#ffffff' // ضمان خلفية بيضاء
      });

      // 2. إعداد PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0); // استخدام JPEG لتقليل الحجم وتسريع المعالجة
      
      // هنا الإصلاح الرئيسي: استخدام new jsPDF بشكل مباشر
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // 3. إنشاء الملف والمشاركة
      const fileName = `Invoice_${orderNo}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // محاولة المشاركة (للموبايل)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `فاتورة رقم ${orderNo}`,
          text: `مرحباً ${customerName}، مرفق فاتورة طلبك.`,
        });
      } else {
        // البديل (للكمبيوتر أو إذا فشلت المشاركة)
        pdf.save(fileName);
        
        // فتح الواتساب (اختياري، لن يرفق الملف أوتوماتيكياً في الويب لكنه يفتح المحادثة)
        if (phone) {
             const waUrl = `https://wa.me/20${phone}?text=${encodeURIComponent('مرفق الفاتورة التي تم تحميلها...')}`;
             window.open(waUrl, '_blank');
        } else {
             alert("تم تحميل ملف PDF على جهازك بنجاح.");
        }
      }

    } catch (error: any) {
      console.error("Error generating PDF:", error);
      // 👇 إظهار رسالة الخطأ الحقيقية لمعرفة السبب
      alert("حدث خطأ تقني: " + (error.message || JSON.stringify(error)));
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
      {loading ? '⏳ جاري المعالجة...' : '📤 مشاركة PDF واتساب'}
    </button>
  );
}