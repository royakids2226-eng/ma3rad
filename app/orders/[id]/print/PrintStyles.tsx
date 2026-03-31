'use client';

const PrintStyles = () => (
  <style jsx global>{`
    @media print {
        @page {
            size: A4;
            margin: 1.5cm; /* A standard margin for printing */
        }

        /* Hide the UI elements that are not part of the invoice. */
        .no-print {
            display: none !important;
        }

        /* Reset screen-specific styles that could interfere. */
        body, .bg-gray-100 {
            background: #ffffff !important;
            min-height: 0 !important;
            color: #000000 !important;
        }

        /* Ensure the printable area takes up the full width and has no shadow. */
        #printable-area {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
        }

        /* Ensure table headers repeat on new pages */
        thead {
            display: table-header-group;
        }

        /* REMOVED the problematic page-break-inside rule */
    }
  `}</style>
);

export default PrintStyles;
