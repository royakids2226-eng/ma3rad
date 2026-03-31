'use client';

const PrintStyles = () => (
  <style jsx global>{`
    @media print {
        @page {
            size: A4;
            margin: 1.5cm; /* A standard margin for printing */
        }

        /* 1. Hide the UI elements that are not part of the invoice. */
        .no-print {
            display: none !important;
        }

        /* 2. Reset any screen-specific styles that could interfere. */
        body, .bg-gray-100 {
            background: #ffffff !important; /* Ensure no background color is printed */
            min-height: 0 !important; /* Don't force a minimum height */
            color: #000000 !important; /* Ensure text is black */
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

        tr, td, th {
            page-break-inside: avoid; /* Prevents rows from splitting across pages */
        }
    }
  `}</style>
);

export default PrintStyles;
