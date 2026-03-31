'use client';

export default function PrintButton() {
  const handlePrint = () => {
    // This simply opens the browser's print dialog.
    // It does not cause a reload or navigation.
    window.print();
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
