'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const lastTotalRef = useRef(0); // ✅ useRef بدل useState
  const lastSeenRef = useRef(0);   // ✅ آخر رقم شاهده المستخدم

  // ============ ١. تهيئة الصوت ============
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.8;
    
    // اقرأ آخر رقم شاهده المستخدم
    const saved = localStorage.getItem('lastSeenNotification');
    lastSeenRef.current = saved ? parseInt(saved) : 0;
    
    console.log('✅ Audio initialized, last seen:', lastSeenRef.current);

    // تفعيل الصوت عند أول تفاعل
    const enableAudio = () => {
      if (audioRef.current && !audioEnabledRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            audioRef.current!.currentTime = 0;
            audioEnabledRef.current = true;
            console.log('🔊 Audio enabled');
          })
          .catch(() => {});
      }
    };

    window.addEventListener('click', enableAudio, { once: true });
    window.addEventListener('keydown', enableAudio, { once: true });

    return () => {
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
  }, []);

  // ============ ٢. تشغيل الصوت ============
  const playSound = () => {
    if (audioRef.current && audioEnabledRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      console.log('🔔 Sound played');
    }
  };

  // ============ ٣. جلب الإشعارات ============
  const checkNotifications = async () => {
    try {
      const total = await getActiveLowStockCount();
      
      // عدد الإشعارات الجديدة = total - آخر رقم شاهده المستخدم
      const newUnread = Math.max(0, total - lastSeenRef.current);
      setUnreadCount(newUnread);
      
      // تشغيل الصوت فقط إذا:
      // 1. فيه إشعارات جديدة (newUnread > 0)
      // 2. العدد الكلي زاد عن المرة السابقة
      if (newUnread > 0 && total > lastTotalRef.current) {
        console.log(`🔔 New notification! Total: ${total}, New: ${newUnread}`);
        playSound();
      }
      
      lastTotalRef.current = total;
      console.log('📊 Total:', total, 'Unread:', newUnread);
      
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ============ ٤. Polling كل ٣ ثواني ============
  useEffect(() => {
    // جلب أول مرة
    checkNotifications();
    
    // Polling كل ٣ ثواني
    const interval = setInterval(checkNotifications, 3000);
    console.log('⏰ Polling started every 3 seconds');
    
    return () => {
      clearInterval(interval);
      console.log('⏰ Polling stopped');
    };
  }, []); // ✅ Dependency array فاضي - يعمل مرة واحدة فقط

  // ============ ٥. عند الضغط على الجرس ============
  const handleClick = () => {
    // سجل أن المستخدم شاهد كل الإشعارات
    lastSeenRef.current = lastTotalRef.current;
    localStorage.setItem('lastSeenNotification', lastTotalRef.current.toString());
    setUnreadCount(0);
    console.log('✅ Notifications marked as seen:', lastTotalRef.current);
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
      
      {/* العداد - يظهر فقط الإشعارات الجديدة */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* مؤشر أن النظام شغال */}
      <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      
      <span className="sr-only">الإشعارات</span>
    </Link>
  );
}