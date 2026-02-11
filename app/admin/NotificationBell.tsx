'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions'; 

interface NotificationBellProps {
    isDark?: boolean;
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [displayCount, setDisplayCount] = useState(0); // الرقم الذي يظهر بالأحمر (الجديد)
    const [lastServerTotal, setLastServerTotal] = useState(0); // آخر إجمالي جاء من السيرفر
    
    // استخدام Ref للصوت لضمان عدم إعادة إنشاء الكائن مع كل ريندر
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // دالة تشغيل الصوت
    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0; // إعادة الصوت للبداية
            audioRef.current.play().catch(error => {
                console.warn("Autoplay blocked by browser. User needs to interact with page first.", error);
            });
        }
    };

    useEffect(() => {
        // 1. تهيئة ملف الصوت (تأكد أن الملف موجود في public/notification.mp3)
        audioRef.current = new Audio('/notification.mp3');

        // قراءة العدد الذي شاهده المستخدم سابقاً
        const storedSeen = localStorage.getItem('seenNotificationsCount');
        const seenCount = storedSeen ? parseInt(storedSeen) : 0;

        const checkNotifications = async () => {
            try {
                // جلب العدد الحالي من السيرفر
                const currentTotal = await getActiveLowStockCount();
                
                setLastServerTotal(prevTotal => {
                    // ⚠️ المنطق الهام: إذا كان العدد الحالي أكبر من السابق، والعدد السابق لم يكن صفراً (لتجنب الصوت عند فتح الصفحة)
                    // أو إذا كان هناك زيادة فعلية في النواقص
                    if (currentTotal > prevTotal && prevTotal !== 0) {
                        playNotificationSound();
                    }
                    return currentTotal;
                });

                // حساب وعرض عدد الإشعارات غير المقروءة
                const diff = Math.max(0, currentTotal - seenCount);
                setDisplayCount(diff);

            } catch (error) {
                console.error("Notification check failed", error);
            }
        };

        // الفحص الأول عند التحميل
        checkNotifications();
        
        // 🔥 الفحص المتكرر كل 3 ثوانٍ (لإعطاء شعور التحديث اللحظي)
        const interval = setInterval(checkNotifications, 3000);

        return () => clearInterval(interval);
    }, []); // Array فارغة ليعمل عند بدء التحميل فقط

    const handleBellClick = () => {
        // عند الضغط، تصفير العداد وتحديث الذاكرة
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
            
            {/* يظهر الرقم فقط إذا كان أكبر من صفر */}
            {displayCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white z-10">
                    {displayCount}
                </span>
            )}
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}