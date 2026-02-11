'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getActiveLowStockCount } from '@/app/admin-actions';
import { sseManager } from '@/lib/sse';

interface NotificationBellProps {
    isDark?: boolean;
}

export default function NotificationBell({ isDark = true }: NotificationBellProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastTotalCount, setLastTotalCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevTotalRef = useRef(0);

    // تهيئة الصوت
    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.volume = 0.8;
    }, []);

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
    };

    // دالة لجلب الإشعارات من السيرفر
    const fetchNotifications = async (isInitialLoad = false) => {
        try {
            const currentTotal = await getActiveLowStockCount();
            console.log('📊 Total low stock:', currentTotal);
            
            const lastSeen = parseInt(localStorage.getItem('ma3rad_last_seen') || '0');
            const newUnread = Math.max(0, currentTotal - lastSeen);
            
            setUnreadCount(newUnread);
            setLastTotalCount(currentTotal);
            
            // تشغيل الصوت للإشعارات الجديدة
            if (newUnread > 0 && currentTotal > prevTotalRef.current && !isInitialLoad) {
                playNotificationSound();
            }
            
            prevTotalRef.current = currentTotal;
            
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    // ١. اتصال SSE للريال تايم
    useEffect(() => {
        // الاتصال بـ SSE
        sseManager.connect();

        // استماع للإشعارات الجديدة
        sseManager.on('notification', (data) => {
            console.log('⚡ Real-time notification received:', data);
            
            // جلب آخر التحديثات فوراً
            fetchNotifications(false);
            
            // تشغيل صوت خاص للإشعارات الآنية
            if (data.type === 'low_stock' || data.type === 'order_created') {
                playNotificationSound();
            }
        });

        // جلب البيانات الأولية
        fetchNotifications(true);

        // الفحص الدوري كـ fallback (كل ١٠ ثواني بدل ٣)
        const interval = setInterval(() => fetchNotifications(false), 10000);

        return () => {
            sseManager.disconnect();
            clearInterval(interval);
        };
    }, []);

    const handleBellClick = () => {
        localStorage.setItem('ma3rad_last_seen', lastTotalCount.toString());
        setUnreadCount(0);
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
            
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full animate-pulse shadow-md border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
            
            {/* مؤشر الاتصال المباشر */}
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}