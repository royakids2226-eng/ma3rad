'use client';

import React from 'react';

const PrintButton = () => {
  const handlePrint = () => {
    const invoiceContent = document.getElementById('invoice-content');
    if (invoiceContent) {
      // Store the original body content
      const originalBody = document.body.innerHTML;

      // Replace the body with the entire invoice element (including the container itself)
      document.body.innerHTML = invoiceContent.outerHTML;

      // Optional: Add a small delay to ensure content is rendered before printing
      setTimeout(() => {
        // Trigger the print dialog
        window.print();

        // Restore the original body content after printing
        // Using a reload to ensure all scripts and styles are re-initialized properly
        window.location.reload();
      }, 250); // 250ms delay
    }
  };

  return (
    <button 
      onClick={handlePrint}
      className="no-print bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      طباعة
    </button>
  );
};

export default PrintButton;
