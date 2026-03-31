'use client';

const PrintStyles = () => (
  <style jsx global>{`
    @media print {
        @page {
            size: A4;
            margin: 1.5cm; /* Add some margin for safety */
        }

        body {
            /* Reset any strange browser-default backgrounds */
            background-color: #fff !important;
        }

        /* Hide everything that is NOT the printable area */
        body * {
            visibility: hidden;
        }

        /* Make sure the printable area and all its children are visible */
        #printable-area, #printable-area * {
            visibility: visible;
        }

        /* 
         * This is the crucial part:
         * Reset the printable area to be a normal block element.
         * This prevents it from being pushed to a new page.
         */
        #printable-area {
            display: block; /* Or just remove any absolute positioning */
            position: static; /* Explicitly set to default */
            width: 100%;
            top: auto;
            left: auto;
            margin: 0;
            padding: 0;
        }

        /* Hide any user interface elements that shouldn't be printed */
        .no-print {
            display: none !important;
        }

        /* Ensure table headers repeat on new pages if the table is long */
        thead {
            display: table-header-group;
        }

        /* Try to prevent table rows from splitting across pages */
        tr, td, th {
            page-break-inside: avoid;
        }
    }
  `}</style>
);

export default PrintStyles;
