'use client';

import { FaWhatsapp } from 'react-icons/fa';

interface ShareOnWhatsappProps {
  phone?: string | null;
  message?: string | null;
  summary: string;
}

export default function ShareOnWhatsapp({ phone, message, summary }: ShareOnWhatsappProps) {
  const handleShare = () => {
    if (!phone) {
      alert('رقم هاتف العميل غير مسجل');
      return;
    }

    const fullMessage = `${message || 'مرحباً'}\n\n${summary}`;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button 
      onClick={handleShare}
      className="flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
    >
      <FaWhatsapp className="h-5 w-5" />
      <span>إرسال واتساب</span>
    </button>
  );
}
