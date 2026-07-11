'use client';

const PrintStylesReceipt = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @media print {

        /* --- Page & Body Core Setup --- */
        @page {
            size: 80mm auto;
            margin: 0;
        }

        body.receipt-print {
            font-family: 'Cairo', sans-serif !important;
            background: #fff !important;
            color: #000 !important; 
            font-size: 12px !important; /* Larger base font for clarity */
            font-weight: 700 !important; /* BOLD text by default */
            width: 100% !important; 
            padding: 0 3mm;      
            box-sizing: border-box; 
            margin: 0 !important;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: none;
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
            padding-top: 3mm;
        }
        .receipt-print header h1 {
            font-size: 18px !important;
            margin: 0 0 2mm 0 !important;
            font-weight: 900 !important; /* EXTRA BOLD Title */
        }
        .receipt-print header p {
            font-size: 12px !important;
            margin: 1mm 0 !important;
        }
        .receipt-print header table td {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 3px 0 !important;
            border-bottom: 1px solid #000 !important; /* Solid black line */
            font-size: 12px !important;
        }

        /* --- Items Table --- */
        .receipt-print #invoice-content > div > table {
            border-collapse: collapse !important; 
            width: 100% !important;
            margin: 4mm 0 !important;
        }
        .receipt-print #invoice-content > div > table th,
        .receipt-print #invoice-content > div > table td {
            padding: 2mm 1mm !important;
            border: 1px solid #000 !important;
            text-align: center !important;
            font-weight: 700 !important; /* BOLD table content */
        }
        .receipt-print #invoice-content > div > table th {
            background: #fff !important; /* NO gray background */
            -webkit-print-color-adjust: exact !important;
            font-weight: 900 !important; /* EXTRA BOLD header */
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
            margin-top: 4mm !important;
            padding-top: 2mm !important;
            border-top: 2px solid #000 !important; /* Thicker solid line */
        }

        /* --- Notes Section --- */
        .receipt-print footer > div:first-child {
            display: block !important; /* RE-ENABLE the notes section */
            text-align: right !important;
            padding: 2mm !important;
            margin-bottom: 3mm !important;
            border: 1px solid #000 !important;
            border-radius: 4px;
        }
        .receipt-print footer > div:first-child h3 {
            font-weight: 900 !important;
            font-size: 13px !important;
            margin: 0 0 1.5mm 0 !important;
            text-align: center !important;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
        }
        .receipt-print footer > div:first-child p {
            font-size: 11px !important;
            font-weight: 700 !important;
            margin: 0 !important;
            padding: 0 !important;
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
            font-size: 13px !important;
            margin-bottom: 1mm !important;
            padding: 2mm 0 !important;
            border-bottom: 1px solid #000 !important; /* Solid black line */
        }
        .receipt-print footer .text-xl {
            border-top: 3px double #000 !important; /* STRONGEST line */
            border-bottom: none !important;
            font-size: 19px !important;   /* LARGEST font */
            font-weight: 900 !important; /* HEAVIEST weight */
            padding-top: 3mm !important;
        }

    }
  `}</style>
);

export default PrintStylesReceipt;
