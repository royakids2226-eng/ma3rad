'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const knownIdsRef = useRef<string[]>([]); // لتتبع الأصناف التي عرفناها مسبقاً لمنع تكرار الصوت

  // ============ ١. تهيئة الصوت ============
  useEffect(() => {
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

  const playSound = () => {
    if (audioRef.current && audioEnabledRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // ============ ٢. جلب الإشعارات (الريال تايم الفعلي) ============
  const checkNotifications = async () => {
    try {
      // ⚠️ نستخدم API Route لضمان عدم وجود Cache وللحصول على IDs الأصناف
      const res = await fetch(`/api/notifications/count?t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!res.ok) return;
      const data = await res.json();
      
      const currentIds = data.ids || [];
      const totalCount = data.count || 0;

      // ✅ تشغيل الصوت فقط إذا ظهر ID جديد لم يكن موجوداً في المرة السابقة
      const hasNewItem = currentIds.some((id: string) => !knownIdsRef.current.includes(id));
      
      if (hasNewItem && knownIdsRef.current.length > 0) {
        playSound();
      }

      // ✅ تحديث الحالة (سيبقى الرقم ظاهراً طالما الصنف رصيده <= 4)
      setUnreadCount(totalCount);
      knownIdsRef.current = currentIds;
      
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    }
  };

  // ============ ٣. Polling كل ٣ ثواني ============
  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/admin/notifications"
      className={`relative group p-2 rounded-xl transition-all mr-2 flex items-center justify-center ${
        isDark 
          ? 'hover:bg-slate-800 text-slate-300 hover:text-yellow-400' 
          : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200'
      }`}
    >
      <span className="text-2xl">🔔</span>

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
          {unreadCount}
        </span>
      )}
      
      <span className="sr-only">الإشعارات</span>
    </Link>
  );
}