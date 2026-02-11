'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';

export default function NotificationBell({ isDark = true }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const lastTotalRef = useRef(0);
  const lastSeenRef = useRef(0); // ✅ اسم واضح: آخر رقم شاهده المستخدم

  // ============ ١. تهيئة الصوت وقراءة localStorage ============
  useEffect(() => {
    // 📌 قراءة آخر رقم شاهده المستخدم من localStorage
    const saved = localStorage.getItem('ma3rad_last_seen');
    if (saved) {
      lastSeenRef.current = parseInt(saved);
      console.log('📖 Loaded last seen from localStorage:', lastSeenRef.current);
    } else {
      // أول مرة: سجل 0
      localStorage.setItem('ma3rad_last_seen', '0');
      lastSeenRef.current = 0;
      console.log('📖 First time, set last seen to 0');
    }

    // 🔊 تهيئة الصوت
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.8;
    audioRef.current.preload = 'auto';
    console.log('✅ Audio initialized');

    // 🖱️ تفعيل الصوت عند أول تفاعل
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
      audioRef.current.play().catch(e => console.log('Audio play error:', e));
      console.log('🔔🔔🔔 PLAYING SOUND!');
    }
  };

  // ============ ٣. جلب الإشعارات ============
  const checkNotifications = async () => {
    try {
      // 📊 جلب العدد الكلي من السيرفر
      const total = await getActiveLowStockCount();
      console.log('📊 Server total low stock:', total);
      console.log('📊 Last seen:', lastSeenRef.current);
      
      // ✅ العداد = العدد الكلي - آخر رقم شاهده المستخدم
      const newUnread = Math.max(0, total - lastSeenRef.current);
      setUnreadCount(newUnread);
      console.log('📊 Unread count:', newUnread);
      
      // 🔔 تشغيل الصوت فقط إذا:
      // 1. فيه إشعارات جديدة (newUnread > 0)
      // 2. والعدد الكلي زاد عن المرة السابقة
      if (newUnread > 0 && total > lastTotalRef.current) {
        console.log('🔔🔔🔔 NEW NOTIFICATION DETECTED!');
        console.log(`🔔 From ${lastTotalRef.current} to ${total}`);
        playSound();
      }
      
      // تحديث آخر عدد كلي
      lastTotalRef.current = total;
      
    } catch (error) {
      console.error('❌ Error checking notifications:', error);
    }
  };

  // ============ ٤. Polling كل ٣ ثواني ============
  useEffect(() => {
    console.log('⏰ Starting notification polling...');
    
    // جلب أول مرة
    checkNotifications();
    
    // Polling كل ٣ ثواني
    const interval = setInterval(checkNotifications, 3000);
    
    return () => {
      console.log('⏰ Stopping notification polling');
      clearInterval(interval);
    };
  }, []); // ✅ مرة واحدة فقط

  // ============ ٥. عند الضغط على الجرس ============
  const handleClick = () => {
    // ✅ تحديث آخر رقم شاهده المستخدم
    lastSeenRef.current = lastTotalRef.current;
    localStorage.setItem('ma3rad_last_seen', lastTotalRef.current.toString());
    setUnreadCount(0);
    console.log('✅ Updated last seen to:', lastTotalRef.current);
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
      
      {/* 🟢 العداد - يظهر فقط الإشعارات الجديدة */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* 🟢 مؤشر أن النظام شغال (يظهر دائمًا) */}
      <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      
      <span className="sr-only">الإشعارات</span>
    </Link>
  );
}