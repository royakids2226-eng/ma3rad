'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastTotal, setLastTotal] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined); // ✅ التصحيح هنا

  // ============ ١. تهيئة الصوت ============
  useEffect(() => {
    // أنشئ كائن الصوت
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.8;
    audioRef.current.preload = 'auto';
    
    console.log('✅ Audio initialized');

    // ⚠️ مهم: شغل الصوت مرة واحدة على الأقل من تفاعل المستخدم
    const enableAudio = () => {
      if (audioRef.current && !audioEnabledRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            audioRef.current!.currentTime = 0;
            audioEnabledRef.current = true;
            console.log('🔊 Audio enabled by user');
          })
          .catch(() => {});
      }
    };

    // استمع لأي تفاعل من المستخدم
    window.addEventListener('click', enableAudio, { once: true });
    window.addEventListener('keydown', enableAudio, { once: true });

    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
  }, []);

  // ============ ٢. تشغيل الصوت ============
  const playSound = () => {
    // شغل الصوت فقط إذا كان مفعّل
    if (audioRef.current && audioEnabledRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play:', e));
      console.log('🔔 Playing notification sound');
    }
  };

  // ============ ٣. جلب الإشعارات ============
  const checkNotifications = async () => {
    try {
      const total = await getActiveLowStockCount();
      console.log('📊 Low stock count:', total);
      
      // اقرأ آخر رقم شاهده المستخدم
      const lastSeen = parseInt(localStorage.getItem('lastSeenNotification') || '0');
      
      // العداد = الجديد فقط
      const newUnread = Math.max(0, total - lastSeen);
      setUnreadCount(newUnread);
      
      // إذا زاد العدد الكلي، شغل الصوت
      if (total > lastTotal) {
        console.log('🔼 Count increased from', lastTotal, 'to', total);
        playSound();
      }
      
      setLastTotal(total);
      
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ============ ٤. نظام بسيط: POLLING فقط ============
  useEffect(() => {
    // جلب أول مرة
    checkNotifications();
    
    // Polling كل 3 ثواني (بسيط ومضمون)
    intervalRef.current = setInterval(checkNotifications, 3000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [lastTotal]);

  // ============ ٥. عند الضغط ============
  const handleClick = () => {
    // سجل أن المستخدم شاهد كل الإشعارات
    localStorage.setItem('lastSeenNotification', lastTotal.toString());
    setUnreadCount(0);
  };

  return (
    <Link 
      href="/admin/notifications" 
      onClick={handleClick}
      className={`relative group p-2 rounded-xl transition-all mr-2 flex items-center justify-center
        ${isDark 
          ? 'hover:bg-slate-800 text-slate-300 hover:text-yellow-400' 
          : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200'
        }`}
    >
      <span className="text-2xl">
        🔔
      </span>
      
      {/* العداد - يظهر فقط الجديد غير المقروء */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* مؤشر الصوت */}
      <span className="absolute -bottom-1 -right-1 text-[8px] opacity-50">
        🔊
      </span>
      
      <span className="sr-only">الإشعارات</span>
    </Link>
  );
}