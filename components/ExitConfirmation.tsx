'use client';

import { useEffect } from 'react';

const ExitConfirmation = () => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // تمنع السلوك الافتراضي للمتصفح
      e.preventDefault();
      // متصفح كروم يتطلب تعيين قيمة لـ returnValue
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
};

export default ExitConfirmation;
