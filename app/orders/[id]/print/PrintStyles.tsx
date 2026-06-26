'use client';

const PrintStyles = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');

    @media print {
        /* ✅ الحجم الافتراضي: A4 */
        @page {
            size: A4;
            margin-top: 4.5cm;
            margin-bottom: 3cm;
            margin-left: 1.5cm;
            margin-right: 1.5cm;

            @bottom-center {
                content: "صفحة " counter(page) " من " counter(pages);
                font-family: 'Cairo', sans-serif;
                font-size: 10px;
                color: #888;
            }
        }

        body {
            font-family: 'Cairo', sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
        }

        .no-print { display: none !important; }

        #invoice-content {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            border: none !important;
            border-top: none !important;
        }

        thead { display: table-header-group; }
        tr, td, th { page-break-inside: avoid; }

        /* ✅ كشف الطابعات الحرارية (80mm) */
        @media (max-width: 80mm) {
            @page {
                size: 80mm auto;
                margin: 3mm;
            }

            body {
                font-size: 11px !important;
                width: 74mm !important;
            }

            #invoice-content {
                width: 74mm !important;
                max-width: 74mm !important;
                padding: 2mm !important;
            }

            /* Header أصغر */
            header {
                margin-bottom: 4mm !important;
                text-align: center !important;
            }

            header h1 { font-size: 14px !important; margin: 0 !important; }
            header p { font-size: 10px !important; margin: 1mm 0 !important; }
            
            header table td {
                display: block !important;
                text-align: center !important;
                padding: 1mm 0 !important;
            }

            /* جدول أصغر */
            table { font-size: 10px !important; }
            th, td { padding: 1mm !important; }
            th { font-size: 9px !important; }

            /* إخفاء عمود التفاصيل */
            th:nth-child(3), td:nth-child(3) { display: none !important; }

            /* Footer مبسط */
            footer > div:first-child { display: none !important; }
            footer > div:last-child { width: 100% !important; }
            
            footer .flex { font-size: 11px !important; }
        }

        /* ✅ كشف الطابعات 58mm */
        @media (max-width: 58mm) {
            @page {
                size: 58mm auto;
                margin: 2mm;
            }

            body {
                font-size: 10px !important;
                width: 54mm !important;
            }

            #invoice-content {
                width: 54mm !important;
                max-width: 54mm !important;
                padding: 1mm !important;
            }

            header h1 { font-size: 12px !important; }
            table { font-size: 9px !important; }
            th, td { padding: 0.5mm !important; }
        }
    }
  `}</style>
);

export default PrintStyles;