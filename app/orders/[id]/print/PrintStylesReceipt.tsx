'use client';

const PrintStylesReceipt = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');

    @media print {
        @page {
            size: 80mm auto;  /* ✅ عرض 80mm - طول تلقائي */
            margin: 3mm;
        }

        body {
            font-family: 'Cairo', sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
            width: 74mm !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        .no-print {
            display: none !important;
        }

        #invoice-content {
            width: 74mm !important;
            max-width: 74mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-top: none !important;
        }

        /* Header مخصص للطابعة الحرارية */
        header {
            margin-bottom: 4mm !important;
            text-align: center !important;
        }

        header h1 {
            font-size: 14px !important;
            margin: 0 !important;
        }

        header p {
            font-size: 10px !important;
            margin: 1mm 0 !important;
        }

        header table {
            font-size: 10px !important;
        }

        header table td {
            padding: 1mm 0 !important;
            display: block !important;
            text-align: center !important;
        }

        /* جدول الأصناف - عمودي */
        table {
            width: 100% !important;
            font-size: 10px !important;
            border-collapse: collapse !important;
        }

        th, td {
            padding: 1mm !important;
            border: 1px solid #333 !important;
            text-align: right !important;
        }

        th {
            background: #f0f0f0 !important;
            font-size: 9px !important;
            -webkit-print-color-adjust: exact !important;
        }

        /* إخفاء أعمدة غير مهمة */
        th:nth-child(1), td:nth-child(1) { /* رقم م */
            width: 8% !important;
        }
        th:nth-child(2), td:nth-child(2) { /* الموديل */
            width: 25% !important;
        }
        th:nth-child(3), td:nth-child(3) { /* التفاصيل */
            display: none !important; /* ✅ إخفاء التفاصيل */
        }
        th:nth-child(4), td:nth-child(4) { /* الكمية */
            width: 12% !important;
        }
        th:nth-child(5), td:nth-child(5) { /* السعر */
            width: 18% !important;
        }
        th:nth-child(6), td:nth-child(6) { /* خصم */
            width: 12% !important;
        }
        th:nth-child(7), td:nth-child(7) { /* الإجمالي */
            width: 25% !important;
        }

        /* Footer totals */
        footer {
            margin-top: 4mm !important;
            padding-top: 2mm !important;
            border-top: 2px dashed #333 !important;
        }

        footer > div:first-child {
            display: none !important; /* ✅ إخفاء الملاحظات */
        }

        footer > div:last-child {
            width: 100% !important;
        }

        footer > div:last-child > div {
            border: none !important;
            padding: 1mm 0 !important;
        }

        footer .flex {
            font-size: 11px !important;
            margin-bottom: 1mm !important;
        }

        /* خط فاصل */
        hr, .separator {
            border: none !important;
            border-top: 1px dashed #333 !important;
            margin: 2mm 0 !important;
        }

        /* منع page-break */
        tr, td, th {
            page-break-inside: avoid !important;
        }

        thead {
            display: table-header-group !important;
        }
    }
  `}</style>
);

export default PrintStylesReceipt;