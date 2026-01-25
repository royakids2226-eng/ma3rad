'use client'
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn('credentials', {
      code,
      password,
      redirect: false,
    });

    if (res?.ok) router.push('/');
    else alert('بيانات خطأ');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4" dir="rtl">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-800">تطبيق الأوردرات</h1>
        
        <label className="block mb-2 text-sm font-bold">كود الموظف</label>
        <input 
          type="text" 
          value={code} 
          onChange={(e) => setCode(e.target.value)}
          className="w-full p-3 border rounded mb-4 bg-gray-50 text-black"
          required
        />

        <label className="block mb-2 text-sm font-bold">كلمة المرور</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 border rounded mb-4 bg-gray-50 text-black"
          required
        />

        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">
          دخول
        </button>
      </form>
    </div>
  );
}