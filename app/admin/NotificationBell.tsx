'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';
import { sse } from '@/lib/sse';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSeenRef = useRef(0);

  // ١. تهيئة الصوت
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.8;
    
    // اقرأ آخر عدد شاهده المستخدم
    const saved = localStorage.getItem('lastSeenNotification');
    lastSeenRef.current = saved ? parseInt(saved) : 0;
  }, []);

  // ٢. تشغيل الصوت
  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        console.log('Audio play failed - will play on first click');
      });
    }
  };

  // ٣. جلب العدد الحالي
  const fetchCount = async (isInitial = false) => {
    try {
      const total = await getActiveLowStockCount();
      const unread = Math.max(0, total - lastSeenRef.current);
      setUnreadCount(unread);
      
      // شغل الصوت إذا فيه جديد وهذي مو أول مرة
      if (unread > 0 && !isInitial) {
        playSound();
      }
      
      console.log('📊 Total:', total, 'Unread:', unread);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ٤. الاتصال بـ SSE والـ Polling
  useEffect(() => {
    // جلب البيانات أول مرة
    fetchCount(true);

    // اتصال SSE
    sse.connect();
    
    // استقبال الإشعارات الفورية
    sse.onNotification((data) => {
      console.log('⚡ Real-time update:', data);
      fetchCount(false); // جلب فوري
    });

    // Polling كـ backup (كل 5 ثواني)
    const interval = setInterval(() => fetchCount(false), 5000);

    return () => {
      sse.disconnect();
      clearInterval(interval);
    };
  }, []);

  // ٥. عند الضغط على الجرس
  const handleClick = () => {
    lastSeenRef.current = lastSeenRef.current + unreadCount;
    localStorage.setItem('lastSeenNotification', lastSeenRef.current.toString());
    setUnreadCount(0);
  };

  return (
    <Link
      href="/admin/notifications"
      onClick={handleClick}
      className={`relative p-2 rounded-xl ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
    >
      <span className="text-2xl">🔔</span>
      
      {/* العداد */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full border-2 border-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      
      {/* مؤشر SSE - يظهر إذا كان متصل */}
      <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
    </Link>
  );
}