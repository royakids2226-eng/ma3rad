'use client';

const PrintStylesReceipt = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @media print {

        /* --- Page & Body Core Setup --- */
        @page {
            size: 80mm auto;
            margin: 0; /* Let the body handle all spacing */
        }

        body.receipt-print {
            font-family: 'Cairo', sans-serif !important;
            background: #fff !important;
            color: #000 !important;
            font-size: 10px !important;
            width: 100% !important; /* Use the full printable area */
            padding: 0 2.5mm;      /* Create safe internal margins */
            box-sizing: border-box; /* Include padding in the width calculation */
            margin: 0 !important;
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
            padding-top: 2mm;
        }
        .receipt-print header h1 {
            font-size: 16px !important;
            margin: 0 0 2mm 0 !important;
        }
        .receipt-print header p {
            font-size: 10px !important;
            margin: 1mm 0 !important;
        }
        .receipt-print header table,
        .receipt-print header tbody,
        .receipt-print header tr {
            display: block !important;
            width: 100% !important;
        }
        .receipt-print header table td {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            text-align: right !important;
            padding: 2.5px 0 !important;
            border: none !important;
            border-bottom: 1px solid #eee !important; /* Softer, cleaner line */
            width: 100% !important;
            font-size: 10px !important;
        }
        .receipt-print header table td span {
          font-weight: bold;
        }

        /* --- Items Table --- */
        .receipt-print #invoice-content > div > table {
            font-size: 10px !important;
            border-collapse: collapse !important; 
            width: 100% !important;
        }
        .receipt-print #invoice-content > div > table th, 
        .receipt-print #invoice-content > div > table td {
            padding: 2mm 1mm !important;
            border: 1px solid #ccc !important;
            text-align: center !important;
            vertical-align: middle;
        }
        .receipt-print #invoice-content > div > table th {
            background: #f0f0f0 !important;
            -webkit-print-color-adjust: exact !important;
        }
        .receipt-print #invoice-content > div > table th:nth-child(3),
        .receipt-print #invoice-content > div > table td:nth-child(3) {
            display: none !important; /* Hide details column */
        }
        .receipt-print #invoice-content > div > table th:nth-child(2),
        .receipt-print #invoice-content > div > table td:nth-child(2) {
            text-align: right !important;
        }

        /* --- Footer & Totals --- */
        .receipt-print footer {
            margin-top: 4mm !important;
            padding-top: 2mm !important;
            border-top: 2px dashed #333 !important;
        }
        .receipt-print footer > div:first-child { 
            display: none !important; /* Hide notes section */
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
            font-size: 11px !important;
            margin-bottom: 1mm !important;
            padding: 1.5mm 0 !important;
            border-bottom: 1px solid #eee !important; /* Softer, cleaner line */
        }
        .receipt-print footer .text-xl {
          border-top: 2px solid #333;
          border-bottom: none !important;
          font-size: 16px !important;
          font-weight: 700 !important;
          color: #000 !important;
          padding-top: 2mm !important;
        }

    }
  `}</style>
);

export default PrintStylesReceipt;
