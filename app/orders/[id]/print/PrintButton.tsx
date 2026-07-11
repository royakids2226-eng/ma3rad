'use client';

export default function PrintButton() {
  const handlePrint = (isReceipt: boolean) => {
    const nonPrintableArea = document.querySelector('.no-print');
    const body = document.body;

    if (isReceipt) {
      body.classList.add('receipt-print');
    }

    if (nonPrintableArea) {
      (nonPrintableArea as HTMLElement).style.display = 'none';
    }

    window.print();

    if (nonPrintableArea) {
      (nonPrintableArea as HTMLElement).style.display = 'flex';
    }

    if (isReceipt) {
      body.classList.remove('receipt-print');
    }
  };

  return (
    <>
      <button 
        onClick={() => handlePrint(false)}
        className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 transition-colors"
      >
        طباعة فاتورة (A4)
      </button>
      <button 
        onClick={() => handlePrint(true)}
        className="bg-green-600 text-white px-6 py-2 rounded-md font-bold hover:bg-green-700 transition-colors"
      >
        طباعة إيصال حراري
      </button>
    </>
  );
}
