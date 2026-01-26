'use client'
import { useEffect, useState } from 'react';
import { getUserOrders, deleteOrder } from '@/app/actions';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function OrdersListPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('EMPLOYEE');
  const [loading, setLoading] = useState(true);
  
  // 👇 حالة البحث الجديدة
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (session?.user?.image) {
      getUserOrders(session.user.image).then(res => {
        setOrders(res.orders);
        setUserRole(res.userRole || 'EMPLOYEE');
        setLoading(false);
      });
    }
  }, [session]);

  const handleDelete = async (orderId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الأوردر؟ لا يمكن التراجع.')) {
        const res = await deleteOrder(orderId);
        if (res.success) {
            setOrders(orders.filter(o => o.id !== orderId));
            alert('تم الحذف بنجاح');
        } else {
            alert('حدث خطأ أثناء الحذف');
        }
    }
  };

  const getWhatsappLink = (phone: string, orderNo: number, total: number) => {
      return `https://wa.me/20${phone}?text=${encodeURIComponent(`مرحباً، تفاصيل فاتورة رقم #${orderNo} بقيمة ${total} ج.م`)}`;
  };

  // 👇 منطق الفلترة (اسم العميل، رقم الأوردر، القيمة)
  const filteredOrders = orders.filter(order => 
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.orderNo.toString().includes(searchTerm) ||
    order.totalAmount.toString().includes(searchTerm)
  );

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">الأوردرات السابقة</h1>
            <Link href="/" className="bg-gray-500 text-white px-4 py-2 rounded text-sm">عودة</Link>
        </div>

        {/* 👇 حقل البحث الجديد */}
        <div className="mb-6">
            <input 
                type="text" 
                placeholder="🔍 ابحث بـ: اسم العميل، رقم الأوردر، أو المبلغ..." 
                className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="space-y-4">
            {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="font-bold text-lg">#{order.orderNo}</span>
                            <span className="text-sm text-gray-500 mr-2">{order.customer.name}</span>
                        </div>
                        <span className="font-bold text-blue-700">{order.totalAmount.toFixed(2)} ج.م</span>
                    </div>
                    
                    <div className="text-xs text-gray-400 mb-4 flex justify-between">
                        <span>{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                        {userRole === 'ADMIN' && <span>بواسطة: {order.user.name}</span>}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Link 
                            href={`/orders/${order.id}/print`}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-bold flex-1 text-center"
                        >
                            طباعة 🖨️
                        </Link>
                        
                        {order.customer.phone && (
                            <a 
                                href={getWhatsappLink(order.customer.phone, order.orderNo, order.totalAmount)}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-bold flex-1 text-center"
                            >
                                واتس 📱
                            </a>
                        )}

                        {userRole === 'ADMIN' && (
                            <>
                                <button 
                                    onClick={() => handleDelete(order.id)}
                                    className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm font-bold flex-1 text-center"
                                >
                                    حذف 🗑️
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ))}
            
            {filteredOrders.length === 0 && (
                <div className="text-center text-gray-500 mt-10">لا توجد نتائج مطابقة للبحث</div>
            )}
        </div>
    </div>
  );
}