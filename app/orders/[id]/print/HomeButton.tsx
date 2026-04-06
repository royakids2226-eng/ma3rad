"use client";
import { useRouter } from 'next/navigation';

export default function HomeButton() {
  const router = useRouter();

  const handleClick = () => {
    if (window.confirm("هل أنت متأكد من الخروج؟ سيتم فقدان كافة التغييرات التي لم يتم حفظها.")) {
      router.push('/');
    }
  };

  return (
    <button 
      onClick={handleClick}
      className="bg-gray-500 text-white px-6 py-2 rounded-md font-bold hover:bg-gray-600 transition-colors"
    >
      العودة للرئيسية
    </button>
  );
}
