'use client'; // 👈 هذا السطر هو الحل السحري

import React from 'react';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 cursor-pointer flex items-center gap-2 shadow-lg"
    >
        🖨️ طباعة الفاتورة
    </button>
  );
}