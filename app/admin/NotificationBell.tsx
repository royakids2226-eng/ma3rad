'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
// استدعاء الدالة الجديدة التي تتجاهل الأصناف المغلقة
import { getActiveLowStockCount } from '@/app/admin-actions'; 

interface NotificationBellProps {
    isDark?: boolean; // خاصية لتحديد لون الأيقونة حسب الخلفية
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [newCount, setNewCount] = useState(0);
    const [serverTotal, setServerTotal] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // تهيئة ملف الصوت - تأكد من وجود الملف في مجلد public
        audioRef.current = new Audio('/notification.mp3');

        const checkNotifications = async () => {
            try {
                // 1. جلب العدد الكلي (للأصناف المفتوحة فقط)
                const total = await getActiveLowStockCount();
                
                // حفظ الرقم القديم للمقارنة من أجل الصوت
                setServerTotal(prev => {
                    // إذا زاد الرقم عن المرة السابقة، نشغل الصوت
                    if (total > prev && prev !== 0) {
                        audioRef.current?.play().catch(e => console.log("Audio play prevented:", e));
                    }
                    return total;
                });

                // 2. قراءة آخر عدد تم مشاهدته من ذاكرة المتصفح
                const storedSeen = localStorage.getItem('seenNotificationsCount');
                const seenCount = storedSeen ? parseInt(storedSeen) : 0;

                // 3. عرض الفرق فقط (الجديد)
                const diff = Math.max(0, total - seenCount);
                setNewCount(diff);

                // تشغيل الصوت عند تحميل الصفحة إذا كان هناك جديد
                if (diff > 0 && typeof window !== 'undefined' && !sessionStorage.getItem('soundPlayed')) {
                    audioRef.current?.play().catch(() => {});
                    sessionStorage.setItem('soundPlayed', 'true');
                }

            } catch (error) {
                console.error("Error checking notifications", error);
            }
        };

        checkNotifications();
        
        // تحديث الرقم كل دقيقة
        const interval = setInterval(checkNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleBellClick = () => {
        // عند الضغط، نعتبر أن المستخدم شاهد كل الإشعارات الحالية
        localStorage.setItem('seenNotificationsCount', serverTotal.toString());
        setNewCount(0);
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
            <span className="text-2xl">🔔</span>
            
            {/* يظهر الرقم فقط إذا كان أكبر من صفر */}
            {newCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
                    {newCount}
                </span>
            )}
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}