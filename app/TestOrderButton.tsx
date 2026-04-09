'use client';

import { useState, useTransition } from 'react';
import { createTestOrder } from './actions/test';

export default function TestOrderButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (confirm('هل أنت متأكد أنك تريد إنشاء فاتورة تجريبية ضخمة (200 صنف)؟ قد تستغرق هذه العملية بضع ثوان.')) {
      startTransition(async () => {
        const result = await createTestOrder(userId);
        if (result.success) {
          alert(result.message);
        } else {
          alert(`فشل: ${result.message}`);
        }
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      <span>{isPending ? 'جاري الإنشاء...' : 'فاتورة تجريبية'}</span>
      <span>{isPending ? '⏱️' : '🧪'}</span>
    </button>
  );
}
