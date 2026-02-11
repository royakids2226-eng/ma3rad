'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions'; 

interface NotificationBellProps {
    isDark?: boolean;
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [displayCount, setDisplayCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previousCountRef = useRef(0);
    const hasInteractedRef = useRef(false);

    // ============ ١. تهيئة الصوت مرة واحدة فقط ============
    useEffect(() => {
        // تأكد من وجود ملف الصوت في المسار الصحيح
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.volume = 0.8;
        audioRef.current.preload = 'auto';
        
        // اختبر إذا الصوت يشتغل
        console.log('✅ Audio initialized');
        
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // ============ ٢. تشغيل الصوت بشكل مضمون ============
    const playSound = async () => {
        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                await audioRef.current.play();
                console.log('🔔 Sound played successfully');
            }
        } catch (error) {
            console.log('❌ Autoplay prevented - waiting for user interaction');
            
            // إذا منع المتصفح التشغيل التلقائي، نشغله عند أول نقرة
            const playOnClick = () => {
                if (audioRef.current && !hasInteractedRef.current) {
                    audioRef.current.play().catch(console.warn);
                    hasInteractedRef.current = true;
                    document.removeEventListener('click', playOnClick);
                }
            };
            document.addEventListener('click', playOnClick, { once: true });
        }
    };

    // ============ ٣. فحص الإشعارات - مبسطة ومضمونة ============
    useEffect(() => {
        let mounted = true;

        const checkNotifications = async () => {
            try {
                const currentCount = await getActiveLowStockCount();
                console.log('📊 Current low stock count:', currentCount);
                
                // العداد: دائماً نعرض العدد الحالي (للتأكد من ظهوره)
                setDisplayCount(currentCount);
                
                // الصوت: يشغل فقط إذا زاد العدد عن المرة السابقة
                if (currentCount > previousCountRef.current) {
                    console.log('🔼 Count increased from', previousCountRef.current, 'to', currentCount);
                    playSound();
                }
                
                // تحديث القيمة السابقة
                previousCountRef.current = currentCount;
                
            } catch (error) {
                console.error('❌ Error checking notifications:', error);
            }
        };

        // فحص فوري
        checkNotifications();
        
        // فحص كل ٣ ثواني
        const interval = setInterval(checkNotifications, 3000);
        
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    // ============ ٤. عند الضغط على الجرس ============
    const handleBellClick = () => {
        // فقط نصفر العداد مؤقتاً
        setDisplayCount(0);
        // لا نغير القيمة المرجعية حتى يستمر الصوت بالعمل
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
            <span className="text-2xl">
                🔔
            </span>
            
            {/* العداد - يظهر دائماً إذا كان العدد أكبر من صفر */}
            {displayCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
                    {displayCount > 9 ? '9+' : displayCount}
                </span>
            )}
            
            {/* مؤشر للتأكد أن الفحص شغال */}
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse opacity-50"></span>
            
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}