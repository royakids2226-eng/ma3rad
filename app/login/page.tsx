'use client'
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerEmployee } from '@/app/actions'; // تأكد من وجود الأكشن في الملف

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false); // للتبديل بين الدخول والتسجيل
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // خاص بالتسجيل فقط
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // معالجة تسجيل الدخول
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await signIn('credentials', {
      code,
      password,
      redirect: false,
    });

    if (res?.ok) {
      router.push('/');
    } else {
      alert('بيانات الدخول غير صحيحة، تأكد من الكود وكلمة المرور');
      setIsLoading(false);
    }
  };

  // معالجة تسجيل موظف جديد
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !password) return alert('يرجى ملء جميع الحقول');
    
    setIsLoading(true);
    const res = await registerEmployee({ name, code, password });
    
    if (res.success) {
      alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول بكودك.');
      setIsRegister(false); // العودة لنموذج الدخول
      setPassword('');
    } else {
      alert('خطأ: ' + res.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans" dir="rtl">
      
      {/* الحاوية الرئيسية (Card) */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] border border-white overflow-hidden">
        
        {/* رأس الصفحة (Header) */}
        <div className="bg-blue-600 p-8 text-center text-white">
          <div className="text-4xl mb-2">👕</div>
          <h1 className="text-2xl font-black mb-1">مصنع الملابس</h1>
          <p className="text-blue-100 text-sm font-medium">
            {isRegister ? 'إنشاء حساب موظف جديد' : 'نظام إدارة المبيعات والطلبات'}
          </p>
        </div>

        {/* جسم الصفحة (Form) */}
        <div className="p-8">
          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-5">
            
            {isRegister && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الثلاثي</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="مثال: محمد أحمد علي"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">كود الموظف</label>
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-3.5 border border-gray-200 rounded-xl bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="أدخل كود الدخول الخاص بك"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3.5 border border-gray-200 rounded-xl bg-gray-50 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  جاري التحميل...
                </span>
              ) : (
                isRegister ? 'تأكيد التسجيل ✅' : 'دخول للنظام ➔'
              )}
            </button>
          </form>

          {/* تذييل الصفحة (Footer Links) */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm mb-3 font-medium">
              {isRegister ? 'لديك حساب بالفعل؟' : 'هل أنت موظف جديد؟'}
            </p>
            <button 
              onClick={() => { setIsRegister(!isRegister); setCode(''); setPassword(''); setName(''); }}
              className="text-blue-600 font-black hover:text-blue-800 transition-colors"
            >
              {isRegister ? 'تسجيل الدخول الآن' : 'إنشاء حساب موظف مبيعات'}
            </button>
          </div>
        </div>
      </div>

      {/* رقم الإصدار أسفل الصفحة */}
      <div className="fixed bottom-4 text-slate-400 text-[10px] font-bold">
        نظام إدارة مصنع الملابس v2.0
      </div>
    </div>
  );
}