'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';

interface NotificationBellProps {
    isDark?: boolean;
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastTotalCount, setLastTotalCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevTotalRef = useRef(0);

    // ============ ١. تهيئة الصوت ============
    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.volume = 0.8;
    }, []);

    // ============ ٢. تشغيل الصوت ============
    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
    };

    // ============ ٣. نظام الإشعارات الحقيقي ============
    useEffect(() => {
        // دالة لجلب العدد الذي شاهده المستخدم آخر مرة
        const getLastSeenCount = () => {
            const stored = localStorage.getItem('ma3rad_last_seen_notification_count');
            return stored ? parseInt(stored) : 0;
        };

        // دالة لحفظ العدد الذي شاهده المستخدم
        const setLastSeenCount = (count: number) => {
            localStorage.setItem('ma3rad_last_seen_notification_count', count.toString());
        };

        const checkNewNotifications = async () => {
            try {
                // ١. جلب العدد الكلي من السيرفر
                const currentTotal = await getActiveLowStockCount();
                console.log('📊 Total low stock:', currentTotal);
                
                // ٢. جلب آخر عدد شاهده المستخدم
                const lastSeen = getLastSeenCount();
                
                // ٣. حساب الجديد فقط (الفرق)
                const newUnread = Math.max(0, currentTotal - lastSeen);
                
                // ٤. تحديث العداد
                setUnreadCount(newUnread);
                console.log('🆕 New unread notifications:', newUnread);
                
                // ٥. تشغيل الصوت فقط إذا:
                //    - فيه إشعارات جديدة (newUnread > 0)
                //    - وإما أن العدد الكلي زاد عن المرة السابقة
                //    - أو أن هذه أول مرة نفحص فيها (prevTotalRef.current === 0)
                if (newUnread > 0) {
                    if (currentTotal > prevTotalRef.current || prevTotalRef.current === 0) {
                        console.log('🔔 New notification arrived! Playing sound...');
                        playNotificationSound();
                    }
                }
                
                // ٦. حفظ العدد الكلي للمقارنة القادمة
                prevTotalRef.current = currentTotal;
                setLastTotalCount(currentTotal);
                
            } catch (error) {
                console.error('Error checking notifications:', error);
            }
        };

        // فحص فوري
        checkNewNotifications();
        
        // فحص كل ٣ ثواني
        const interval = setInterval(checkNewNotifications, 3000);
        
        return () => clearInterval(interval);
    }, []);

    // ============ ٤. عند الضغط على الجرس ============
    const handleBellClick = () => {
        // سجل أن المستخدم شاهد كل الإشعارات
        localStorage.setItem('ma3rad_last_seen_notification_count', lastTotalCount.toString());
        setUnreadCount(0);
        console.log('✅ All notifications marked as seen');
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
            
            {/* العداد: يظهر فقط الجديد غير المقروء */}
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
            
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}