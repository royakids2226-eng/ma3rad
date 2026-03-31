'use client';

const PrintStyles = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @media print {
        @page {
            size: A4;
            margin-top: 4.5cm;
            margin-bottom: 3cm;
            margin-left: 1.5cm;
            margin-right: 1.5cm;

            @top-center {
                content: '${siteName}';
                font-size: 14px;
                font-weight: bold;
                color: #333;
            }

            @top-right {
                content: '${customerName}';
                font-size: 12px;
                color: #555;
            }

            @bottom-center {
                content: "Page " counter(page);
                font-size: 10px;
                color: #888;
            }
        }

        /* 1. Hide the UI elements that are not part of the invoice. */
        .no-print {
            display: none !important;
        }

        /* 2. Reset any screen-specific styles that could interfere. */
        body, .bg-gray-100 {
            background: #ffffff !important;
            min-height: 0 !important;
            color: #000000 !important;
        }

        /* 3. Ensure the printable area takes up the full width and has no shadow. */
        #printable-area {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
        }

        /* 4. Basic print typography improvements. */
        thead {
            display: table-header-group; /* Repeats table headers on each page */
        }

        /* RESTORING this rule to prevent the large gap */
        tr, td, th {
            page-break-inside: avoid;
        }
    }
  `}</style>
);

export default PrintStyles;
