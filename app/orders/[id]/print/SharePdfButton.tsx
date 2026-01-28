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
      // 1. التقاط الصورة مع إجبار الألوان
      const canvas = await html2canvas(input, {
        scale: 2, // جودة عالية
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // خلفية بيضاء صريحة (HEX)
        onclone: (documentClone) => {
            // هذه الخطوة تضمن أن العنصر المنسوخ يستخدم ألواناً بسيطة
            const element = documentClone.getElementById('invoice-content');
            if (element) {
                element.style.backgroundColor = '#ffffff';
                element.style.color = '#000000';
            }
        }
      });

      // 2. إعداد ملف PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95); // استخدام JPEG لتقليل الحجم
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // 3. تجهيز الملف للمشاركة
      const fileName = `Invoice_${orderNo}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // 4. المحاولة: مشاركة عبر الموبايل (Native Share)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `فاتورة رقم ${orderNo}`,
          text: `مرحباً ${customerName}، مرفق فاتورة طلبك.`,
        });
      } else {
        // 5. البديل: التحميل المباشر وفتح واتساب ويب
        pdf.save(fileName);
        
        if (phone) {
             // فتح واتساب ويب (يجب على المستخدم سحب الملف يدوياً)
             const waUrl = `https://wa.me/20${phone}?text=${encodeURIComponent('مرفق الفاتورة (يرجى سحب ملف PDF المحمل هنا)...')}`;
             window.open(waUrl, '_blank');
        } else {
             alert("تم تحميل ملف PDF بنجاح.");
        }
      }

    } catch (error: any) {
      console.error("Error generating PDF:", error);
      // عرض تفاصيل الخطأ للمساعدة
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