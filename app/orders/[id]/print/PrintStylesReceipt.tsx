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
            color: #000 !important; /* Force black for all text */
            font-size: 11px !important; /* Slightly larger base font */
            font-weight: 600 !important; /* Bolder base font for thermal print */
            width: 100% !important; 
            padding: 0 3mm;      
            box-sizing: border-box; 
            margin: 0 !important;
            /* --- Anti-aliasing & Rendering Fixes for Pixelation --- */
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
            font-size: 17px !important;
            margin: 0 0 2mm 0 !important;
            font-weight: 700 !important;
        }
        .receipt-print header p {
            font-size: 11px !important;
            margin: 1mm 0 !important;
        }
        .receipt-print header table td {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 3px 0 !important;
            border-bottom: 1px dashed #000 !important; /* Black dashed line */
            font-size: 11px !important;
        }
        .receipt-print header table td span {
          font-weight: 700; /* Bolder label */
        }

        /* --- Items Table --- */
        .receipt-print #invoice-content > div > table {
            border-collapse: collapse !important; 
            width: 100% !important;
        }
        .receipt-print #invoice-content > div > table th, 
        .receipt-print #invoice-content > div > table td {
            padding: 2mm 1mm !important;
            border: 1px solid #000 !important; /* Black borders */
            text-align: center !important;
            font-weight: 600 !important;
        }
        .receipt-print #invoice-content > div > table th {
            background: #f0f0f0 !important;
            -webkit-print-color-adjust: exact !important;
            font-weight: 700 !important;
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
            border-top: 1px solid #000 !important; /* Solid black line */
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
            font-size: 12px !important;
            margin-bottom: 1mm !important;
            padding: 2mm 0 !important;
            border-bottom: 1px dashed #000 !important; /* Black dashed line */
        }
        .receipt-print footer .text-xl {
          border-top: 2px double #000 !important; /* Stronger double line */
          border-bottom: none !important;
          font-size: 18px !important;
          font-weight: 700 !important;
          color: #000 !important;
          padding-top: 2mm !important;
        }

    }
  `}</style>
);

export default PrintStylesReceipt;
