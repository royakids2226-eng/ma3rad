'use client';

export default function PrintButton() {
  const handlePrint = () => {
    // This is the new, correct logic.
    // It manually hides the button container before printing
    // and shows it again after, avoiding the race condition.

    const nonPrintableArea = document.querySelector('.no-print');

    if (nonPrintableArea) {
      // 1. Hide the button container.
      (nonPrintableArea as HTMLElement).style.display = 'none';
    }

    // 2. Open the browser's print dialog.
    window.print();

    // 3. Show the button container again after the dialog is closed.
    if (nonPrintableArea) {
      (nonPrintableArea as HTMLElement).style.display = 'flex';
    }
  };

  return (
    <button 
      onClick={handlePrint}
      className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 transition-colors"
    >
      طباعة الفاتورة
    </button>
  );
}
