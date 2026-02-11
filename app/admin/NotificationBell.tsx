'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const previousTotalRef = useRef(0); // للمقارنة وتشغيل الصوت
  const lastSeenRef = useRef(0); // آخر إجمالي شاهده المستخدم

  // ============ ١. تهيئة الصوت وقراءة localStorage ============
  useEffect(() => {
    // قراءة آخر رقم شاهده المستخدم من التخزين المحلي
    const saved = localStorage.getItem('ma3rad_notification_last_seen');
    lastSeenRef.current = saved ? parseInt(saved) : 0;

    // تهيئة ملف الصوت
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.8;

    // تفعيل الصوت بعد أول نقرة للمستخدم (سياسة المتصفحات)
    const enableAudio = () => {
      if (audioRef.current && !audioEnabledRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            audioRef.current!.currentTime = 0;
            audioEnabledRef.current = true;
            console.log('🔊 Audio enabled and ready');
          })
          .catch(() => {});
      }
    };

    window.addEventListener('click', enableAudio, { once: true });
    return () => window.removeEventListener('click', enableAudio);
  }, []);

  // ============ ٢. دالة تشغيل الصوت ============
  const playSound = () => {
    if (audioRef.current && audioEnabledRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // ============ ٣. جلب الإشعارات (الريال تايم) ============
  const checkNotifications = async () => {
    try {
      // ⚠️ نستخدم fetch مع API Route لمنع الكاش نهائياً
      // نضع timestamp عشوائي في نهاية الرابط لضمان جلب بيانات جديدة كل مرة
      const res = await fetch(`/api/notifications/count?t=${new Date().getTime()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) return;
      const data = await res.json();
      const total = data.count; // الإجمالي الحالي للأصناف <= 4

      // ✅ تشغيل الصوت فقط إذا زاد العدد الإجمالي عن آخر فحص
      // (يعني دخل صنف جديد في مرحلة نقص المخزون)
      if (total > previousTotalRef.current && total > lastSeenRef.current) {
        console.log('🔔 New notification detected!');
        playSound();
      }

      // ✅ حساب العدد غير المقروء ليظهر على الجرس
      const newUnread = Math.max(0, total - lastSeenRef.current);
      setUnreadCount(newUnread);

      // تحديث المرجع للمقارنة القادمة
      previousTotalRef.current = total;
      
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    }
  };

  // ============ ٤. Polling كل ٣ ثواني ============
  useEffect(() => {
    checkNotifications(); // فحص فوري عند التحميل
    const interval = setInterval(checkNotifications, 3000);
    return () => clearInterval(interval);
  }, []);

  // ============ ٥. عند الضغط على الجرس ============
  const handleClick = () => {
    // "تصفير" الإشعارات عن طريق مساواة lastSeen بالإجمالي الحالي
    const currentTotal = previousTotalRef.current;
    lastSeenRef.current = currentTotal;
    localStorage.setItem('ma3rad_notification_last_seen', currentTotal.toString());
    setUnreadCount(0);
  };

  return (
    <Link
      href="/admin/notifications"
      onClick={handleClick}
      className={`relative group p-2 rounded-xl transition-all mr-2 flex items-center justify-center ${
        isDark 
          ? 'hover:bg-slate-800 text-slate-300 hover:text-yellow-400' 
          : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200'
      }`}
    >
      <span className="text-2xl">
        🔔
      </span>

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      <span className="sr-only">الإشعارات</span>
    </Link>
  );
}