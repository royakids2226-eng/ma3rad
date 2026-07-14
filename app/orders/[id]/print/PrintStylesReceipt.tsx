'use client';

const PrintStylesReceipt = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');

    @media print {

        /* --- Page & Body Core Setup --- */
        @page {
            size: 80mm auto;
            margin: 0;
        }

        body.receipt-print {
            font-family: 'Cairo', 'Arial', sans-serif !important;
            background: #fff !important;
            color: #000 !important; 
            font-size: 12px !important;
            font-weight: 400 !important; /* العودة للوزن العادي لمنع التكتل والبهتان */
            width: 100% !important; 
            padding: 0 4mm;      
            box-sizing: border-box; 
            margin: 0 !important;
            
            /* الحيلة السحرية لتحسين حدة الخطوط في الطابعات الحرارية */
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
        }

        .receipt-print .no-print {
            display: none !important;
        }

        .receipt-print #invoice-content {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
        }

        /* --- Header --- */
        .receipt-print header {
            text-align: center !important;
            margin-bottom: 4mm !important;
            padding-top: 4mm;
        }
        .receipt-print header h1 {
            font-size: 16px !important; /* تقليل بسيط لمنع تداخل النقاط الحرارية */
            margin: 0 0 2mm 0 !important;
            font-weight: 800 !important; /* سمك حاد ومناسب للعناوين */
        }
        .receipt-print header p {
            font-size: 11px !important;
            margin: 1mm 0 !important;
            font-weight: 400 !important;
        }
        .receipt-print header table td {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 4px 0 !important;
            border-bottom: 1px solid #000 !important; 
            font-size: 11px !important;
            font-weight: 600 !important; /* سمك متوسط واضح للقراءة */
        }

        /* --- Items Table --- */
        .receipt-print #invoice-content > div > table {
            border-collapse: collapse !important; 
            width: 100% !important;
            margin: 3mm 0 !important;
        }
        .receipt-print #invoice-content > div > table th,
        .receipt-print #invoice-content > div > table td {
            padding: 1.5mm 1mm !important;
            border: 1px solid #000 !important;
            text-align: center !important;
            font-size: 11px !important;
            font-weight: 400 !important; 
        }
        .receipt-print #invoice-content > div > table th {
            background: #fff !important; 
            -webkit-print-color-adjust: exact !important;
            font-weight: 800 !important; /* العناوين فقط تكون عريضة */
        }
        .receipt-print #invoice-content > div > table th:nth-child(3),
        .receipt-print #invoice-content > div > table td:nth-child(3) {
            display: none !important;
        }
        .receipt-print #invoice-content > div > table th:nth-child(2),
        .receipt-print #invoice-content > div > table td:nth-child(2) {
            text-align: right !important;
        }

        /* --- Footer & Totals --- */
        .receipt-print footer {
            margin-top: 3mm !important;
            padding-top: 1mm !important;
            border-top: 1.5px solid #000 !important; 
        }

        /* --- Notes Section --- */
        .receipt-print footer > div:first-child {
            display: block !important; 
            text-align: right !important;
            padding: 2mm !important;
            margin-bottom: 3mm !important;
            border: 1px solid #000 !important;
            border-radius: 2px;
        }
        .receipt-print footer > div:first-child h3 {
            font-weight: 800 !important;
            font-size: 12px !important;
            margin: 0 0 1.5mm 0 !important;
            text-align: center !important;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
        }
        .receipt-print footer > div:first-child p {
            font-size: 10px !important;
            font-weight: 400 !important; /* جعل نص الملاحظات عادي ليكون حاداً جداً */
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.4 !important;
        }

        .receipt-print footer > div:last-child {
            width: 100% !important;
        }
        .receipt-print footer div[class*="p-6"] {
            border: none !important;
            padding: 0 !important;
        }
        .receipt-print footer div[class*="p-6"] > div {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 12px !important;
            margin-bottom: 1mm !important;
            padding: 1.5mm 0 !important;
            border-bottom: 1px solid #000 !important; 
            font-weight: 600 !important;
        }
        .receipt-print footer .text-xl {
            border-top: 2px double #000 !important; 
            border-bottom: none !important;
            font-size: 16px !important;   /* حجم متناسق لا يسبب تداخل النقاط */
            font-weight: 800 !important; 
            padding-top: 2mm !important;
        }

    }
  `}</style>
);

export default PrintStylesReceipt;