'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions'; 

interface NotificationBellProps {
    isDark?: boolean;
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [displayCount, setDisplayCount] = useState(0);
    const [lastServerTotal, setLastServerTotal] = useState(0);
    const [audioReady, setAudioReady] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isFirstLoad = useRef(true);
    const prevTotalRef = useRef(0);

    // تهيئة الصوت بشكل أفضل
    useEffect(() => {
        // محاولة تحميل الصوت من مصادر متعددة
        const audio = new Audio();
        
        // قائمة المسارات المحتملة للصوت
        const audioPaths = [
            '/notification.mp3',
            '/sounds/notification.mp3',
            '/audio/notification.mp3',
            '/notifications/notification.mp3'
        ];
        
        let currentPathIndex = 0;
        
        const tryLoadAudio = () => {
            if (currentPathIndex >= audioPaths.length) {
                console.warn('No audio file found in any path');
                return;
            }
            
            audio.src = audioPaths[currentPathIndex];
            audio.load();
        };
        
        audio.addEventListener('canplaythrough', () => {
            audioRef.current = audio;
            setAudioReady(true);
            console.log(`✅ Audio loaded successfully from: ${audio.src}`);
        });
        
        audio.addEventListener('error', () => {
            currentPathIndex++;
            tryLoadAudio();
        });
        
        tryLoadAudio();
        
        audio.volume = 0.7;
        
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    // دالة تشغيل الصوت المحسنة
    const playNotificationSound = () => {
        if (!audioReady || !audioRef.current) {
            console.warn('Audio not ready yet');
            return;
        }
        
        try {
            audioRef.current.currentTime = 0;
            
            // محاولة تشغيل الصوت مع معالجة autoplay policy
            const playPromise = audioRef.current.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Browser autoplay policy prevented sound:', error);
                    
                    // محاولة بديلة: تشغيل الصوت بعد تفاعل المستخدم
                    const playOnInteraction = () => {
                        audioRef.current?.play().catch(console.warn);
                        document.removeEventListener('click', playOnInteraction);
                        document.removeEventListener('keydown', playOnInteraction);
                    };
                    
                    document.addEventListener('click', playOnInteraction, { once: true });
                    document.addEventListener('keydown', playOnInteraction, { once: true });
                });
            }
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    useEffect(() => {
        // قراءة العدد الذي شاهده المستخدم سابقاً
        const storedSeen = localStorage.getItem('seenNotificationsCount');
        const seenCount = storedSeen ? parseInt(storedSeen) : 0;

        const checkNotifications = async () => {
            try {
                const currentTotal = await getActiveLowStockCount();
                
                // ✅ المنطق المحسن لتشغيل الصوت
                if (!isFirstLoad.current) {
                    // الحالة 1: زيادة في العدد
                    if (currentTotal > prevTotalRef.current) {
                        console.log(`🔔 New notification! Stock low count: ${currentTotal}`);
                        playNotificationSound();
                    }
                    // الحالة 2: عودة نفس العدد بعد أن كان صفر (مهم)
                    else if (currentTotal > 0 && prevTotalRef.current === 0) {
                        console.log(`🔔 Notifications reappeared: ${currentTotal}`);
                        playNotificationSound();
                    }
                } else {
                    isFirstLoad.current = false;
                }
                
                prevTotalRef.current = currentTotal;
                setLastServerTotal(currentTotal);

                // حساب وعرض عدد الإشعارات غير المقروءة
                const diff = Math.max(0, currentTotal - seenCount);
                
                // ✅ تحديث العداد حتى لو كان صفر (لإخفاء الرقم)
                setDisplayCount(diff);

            } catch (error) {
                console.error("❌ Notification check failed", error);
            }
        };

        // فوري ثم كل 3 ثواني
        checkNotifications();
        const interval = setInterval(checkNotifications, 3000);

        return () => clearInterval(interval);
    }, []);

    const handleBellClick = () => {
        // تحديث localStorage بالقيمة الحالية
        localStorage.setItem('seenNotificationsCount', lastServerTotal.toString());
        setDisplayCount(0);
    };

    return (
        <Link 
            href="/admin/notifications" 
            onClick={handleBellClick}
            className={`relative group p-2 rounded-xl transition-all mr-2 flex items-center justify-center
                ${isDark 
                    ? 'hover:bg-slate-800 text-slate-300 hover:text-yellow-400' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600 border border-transparent hover:border-gray-200'
                }`}
        >
            <span className={`text-2xl transition-transform duration-300 ${displayCount > 0 ? 'group-hover:rotate-12' : ''}`}>
                🔔
            </span>
            
            {displayCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white z-10">
                    {displayCount > 9 ? '9+' : displayCount}
                </span>
            )}
            
            {/* أيقونة الصوت الصغيرة لتعرف أن النظام يعمل */}
            {audioReady && (
                <span className="absolute -bottom-1 -right-1 text-[8px] opacity-50">
                  🔊
                </span>
            )}
            
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}