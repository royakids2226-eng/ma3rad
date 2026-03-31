'use client';

const PrintStyles = () => (
  <style jsx global>{`
    @media print {
      body * {
        visibility: hidden;
      }
      #invoice-content,
      #invoice-content * {
        visibility: visible;
      }
      #invoice-content {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 20px;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  `}</style>
);

export default PrintStyles;
