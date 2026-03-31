'use client';

const PrintStyles = ({ siteName, customerName }: { siteName: string, customerName: string }) => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');

    @media print {
        @page {
            size: A4;
            margin-top: 4.5cm;
            margin-bottom: 3cm;
            margin-left: 1.5cm;
            margin-right: 1.5cm;

            @top-center {
                content: '${siteName}';
                font-family: 'Cairo', sans-serif;
                font-size: 14px;
                font-weight: bold;
                color: #333;
            }

            @top-right {
                content: '${customerName}';
                font-family: 'Cairo', sans-serif;
                font-size: 12px;
                color: #555;
            }

            @bottom-center {
                content: "Page " counter(page);
                font-family: 'Cairo', sans-serif;
                font-size: 10px;
                color: #888;
            }
        }

        /* 1. Hide the UI elements that are not part of the invoice. */
        .no-print {
            display: none !important;
        }

        /* 2. Reset any screen-specific styles and set the print font. */
        body, .bg-gray-100, #printable-area {
            font-family: 'Cairo', sans-serif !important;
            background: #ffffff !important;
            min-height: 0 !important;
            color: #000000 !important;
        }

        /* 3. Ensure the printable area takes up the full width and has no shadow. */
        #printable-area {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !importan;
            max-width: 100% !important;
        }

        /* 4. Style the table headers with a border. */
        thead {
            display: table-header-group; /* Repeats table headers on each page */
        }

        thead th {
            border: 1px solid #000;
            padding: 8px; /* Adjust padding as needed */
            font-weight: bold;
            text-align: center;
        }

        /* RESTORING this rule to prevent the large gap */
        tr, td, th {
            page-break-inside: avoid;
        }
        
        td {
            padding: 4px 8px;
        }
    }
  `}</style>
);

export default PrintStyles;
