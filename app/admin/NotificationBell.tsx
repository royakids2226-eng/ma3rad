'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';

export default function NotificationBell({ isDark = true }) {
const [unreadCount, setUnreadCount] = useState(0);
const audioRef = useRef<HTMLAudioElement | null>(null);
const audioEnabledRef = useRef(false);
const previousTotalRef = useRef(0); // للمقارنة فقط (تشغيل الصوت)
const lastSeenRef = useRef(0); // آخر رقم شاهده المستخدم

// ============ ١. تهيئة الصوت وقراءة localStorage ============
useEffect(() => {
const saved = localStorage.getItem('ma3rad_notification_last_seen');
lastSeenRef.current = saved ? parseInt(saved) : 0;

audioRef.current = new Audio('/notification.mp3');
audioRef.current.volume = 0.8;

const enableAudio = () => {
  if (audioRef.current && !audioEnabledRef.current) {
    audioRef.current.play()
      .then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
        audioEnabledRef.current = true;
      })
      .catch(() => {});
  }
};

window.addEventListener('click', enableAudio, { once: true });
return () => window.removeEventListener('click', enableAudio);
}, []);

// ============ ٢. تشغيل الصوت ============
const playSound = () => {
if (audioRef.current && audioEnabledRef.current) {
audioRef.current.currentTime = 0;
audioRef.current.play().catch(() => {});
}
};

// ============ ٣. جلب الإشعارات ============
const checkNotifications = async () => {
try {
  // جلب العدد الفعلي الحالي من السيرفر للأصناف OPEN التي رصيدها <= 4
  const total = await getActiveLowStockCount();

  // ✅ العدد غير المقروء = العدد الكلي الحالي - آخر عدد "صَفَّر" عنده المستخدم الإشعارات
  const newUnread = Math.max(0, total - lastSeenRef.current);
  setUnreadCount(newUnread);
  
  // ✅ تشغيل الصوت فقط إذا زاد إجمالي عدد النواقص عن آخر فحص
  // وهذا يعني أن هناك منتجاً جديداً وصل للحد الأدنى
  if (total > previousTotalRef.current && newUnread > 0) {
    playSound();
  }
  
  previousTotalRef.current = total;
  
} catch (error) {
  console.error('❌ Error:', error);
}
};

// ============ ٤. Polling كل ٣ ثواني ============
useEffect(() => {
checkNotifications();
const interval = setInterval(checkNotifications, 3000);
return () => clearInterval(interval);
}, []);

// ============ ٥. عند الضغط على الجرس ============
const handleClick = () => {
// تحديث lastSeen ليكون مساوياً للعدد الكلي الحالي
lastSeenRef.current = previousTotalRef.current;
localStorage.setItem('ma3rad_notification_last_seen', previousTotalRef.current.toString());
setUnreadCount(0);
};

return (
<Link
href="/admin/notifications"
onClick={handleClick}
className={`relative group p-2 rounded-xl transition-all mr-2 flex items-center justify-center ${isDark ? 'hover:bg-slate-800 text-slate-300 hover:text-yellow-400' : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200'}`}
>
<span className="text-2xl">🔔</span>

{unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
  
  <span className="sr-only">الإشعارات</span>
</Link>
);
}