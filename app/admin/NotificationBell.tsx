'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLowStockClosedCount } from '@/app/admin-actions'; // تأكد أن المسار صحيح

export default function NotificationBell() {
    const [newCount, setNewCount] = useState(0);
    const [serverTotal, setServerTotal] = useState(0);

    useEffect(() => {
        // دالة لجلب العدد الكلي وحساب الجديد
        const checkNotifications = async () => {
            try {
                // 1. جلب العدد الكلي الحالي من السيرفر
                const total = await getLowStockClosedCount();
                setServerTotal(total);

                // 2. قراءة العدد الذي شاهده المستخدم آخر مرة من المتصفح
                const storedSeen = localStorage.getItem('seenNotificationsCount');
                const seenCount = storedSeen ? parseInt(storedSeen) : 0;

                // 3. حساب الفرق (الجديد فقط)
                // إذا كان العدد الكلي أكبر من المشاهد، نظهر الفرق. وإلا صفر
                const diff = Math.max(0, total - seenCount);
                setNewCount(diff);
            } catch (error) {
                console.error("Error checking notifications", error);
            }
        };

        checkNotifications();
        
        // يمكن تفعيل هذا السطر إذا أردت تحديث الرقم كل دقيقة مثلاً
        // const interval = setInterval(checkNotifications, 60000);
        // return () => clearInterval(interval);
    }, []);

    const handleBellClick = () => {
        // عند الضغط على الجرس، نعتبر أن المستخدم شاهد كل الموجود حالياً
        localStorage.setItem('seenNotificationsCount', serverTotal.toString());
        setNewCount(0);
    };

    return (
        <Link 
            href="/admin/notifications" 
            onClick={handleBellClick}
            className="relative group p-2 hover:bg-slate-800 rounded-xl transition-all"
        >
            <span className="text-xl group-hover:text-yellow-400 transition-colors">🔔</span>
            
            {/* يظهر البادج فقط إذا كان هناك إشعارات جديدة */}
            {newCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-lg border-2 border-slate-900">
                    {newCount}
                </span>
            )}
            <span className="sr-only">الإشعارات</span>
        </Link>
    );
}