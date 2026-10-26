'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import NotificationBell from './NotificationBell'

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  color: string;
  href: string;
  roles: string[];
}

export default function AdminDashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ✅ التصحيح الجوهري: قراءة الصلاحية (role) بدقة من السيشن مع حماية افتراضية
  const userRole = (session?.user as any)?.role || 'ADMIN'; 

  const allMenuItems: MenuItem[] = [
    { id: 'orders', title: 'الأوردرات', icon: '🛒', color: 'from-blue-500 to-blue-700', href: '/orders/new', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'cash', title: 'النقدية والخزينة', icon: '💰', color: 'from-green-500 to-green-700', href: '/payments/new', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'purchase-returns', title: 'مرتجع مشتريات', icon: '📤', color: 'from-red-600 to-rose-800', href: '/admin/purchases/returns/new', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'returns', title: 'المرتجعات', icon: '↩️', color: 'from-red-500 to-red-700', href: '/admin/returns', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'customers', title: 'العملاء', icon: '👥', color: 'from-orange-500 to-orange-700', href: '/admin/customers', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'inventory', title: 'المخزون والأصناف', icon: '📦', color: 'from-purple-500 to-purple-700', href: '/admin/products', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
    { id: 'purchases', title: 'فاتورة مشتريات', icon: '📥', color: 'from-violet-600 to-purple-800', href: '/admin/purchases/new', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'financial-reports', title: 'القوائم المالية والأرباح', icon: '📈', color: 'from-emerald-600 to-teal-800', href: '/admin/reports/financial', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'financial-papers', title: 'الشيكات والأوراق المالية', icon: '📑', color: 'from-teal-600 to-emerald-800', href: '/admin/financial-papers', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'debtors-creditors', title: 'الدائنون والمدينون (قروض)', icon: '🤝', color: 'from-indigo-600 to-purple-800', href: '/admin/debtors-creditors', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'assets', title: 'الأصول الثابتة الرأسمالية', icon: '🏭', color: 'from-cyan-600 to-blue-800', href: '/admin/assets', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'offers', title: 'إدارة العروض', icon: '🏷️', color: 'from-pink-500 to-rose-600', href: '/admin/offers', roles: ['ADMIN', 'OWNER'] },
    { id: 'audits', title: 'إدارة الجرد', icon: '⚖️', color: 'from-cyan-500 to-blue-700', href: '/admin/inventory-audits', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'vendors', title: 'الموردين', icon: '🏪', color: 'from-amber-500 to-amber-700', href: '/admin/vendors', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'reports', title: 'التقارير المركزية', icon: '📊', color: 'from-teal-500 to-emerald-700', href: '/admin/reports', roles: ['ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { id: 'users', title: 'الموظفين والصلاحيات', icon: '👔', color: 'from-indigo-500 to-indigo-700', href: '/admin/users', roles: ['ADMIN', 'OWNER'] },
    { id: 'settings', title: 'الإعدادات', icon: '⚙️', color: 'from-gray-500 to-gray-700', href: '/admin/settings', roles: ['ADMIN', 'OWNER'] },
  ]

  // فلترة العناصر حسب صلاحية المستخدم الحقيقية
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl font-bold animate-pulse">جاري تحميل لوحة التحكم...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 w-full" dir="rtl">
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-white hover:text-blue-400 transition font-bold">
              ← خروج للرئيسية
            </button>
            <div className="bg-blue-600 px-4 py-2 rounded-lg font-bold text-white text-sm">
              لوحة التحكم المحاسبية والإدارية
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell isDark={true} />
            <div className="text-left">
              <div className="text-white font-bold">{session?.user?.name || 'مدير النظام'}</div>
              <div className="text-xs text-gray-400 font-mono">{userRole}</div>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {session?.user?.name?.[0] || 'A'}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 md:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-2">
            لوحة التحكم المحاسبية والإدارية
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            نظام إدارة المبيعات، المخازن، والأصول المالية - RoyalKids
          </p>
        </div>

        {/* عرض الدوائر المحيطة في الشاشات المتوسطة والكبيرة */}
        <div className="hidden md:block relative mx-auto" style={{ height: '750px', maxWidth: '900px' }}>
          {/* الدائرة المركزية */}
          <div 
            className="absolute top-1/2 left-1/2 z-10"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-40 h-40 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-700 animate-pulse-glow">
              <div className="text-center">
                <div className="text-3xl font-black text-white">modoo</div>
                <div className="text-xs text-gray-200 font-mono">v2.0</div>
              </div>
            </div>
          </div>

          {/* الدوائر الفرعية الموزعة دائرياً */}
          {menuItems.map((item, index) => {
            const angle = (index * (360 / menuItems.length)) * (Math.PI / 180)
            const radius = 320
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius

            return (
              <div
                key={item.id}
                className="absolute top-1/2 left-1/2"
                style={{ 
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` 
                }}
              >
                <button
                  onClick={() => router.push(item.href)}
                  className="group block"
                >
                  <div
                    className={`
                      w-36 h-36 
                      bg-gradient-to-br ${item.color}
                      rounded-full 
                      flex flex-col items-center justify-center 
                      shadow-xl 
                      hover:scale-125 
                      hover:shadow-2xl 
                      transition-all 
                      duration-300
                      border-4 border-slate-800
                      animate-float
                      relative
                      cursor-pointer
                    `}
                    style={{ animationDelay: `${index * 0.25}s` }}
                  >
                    <div className="text-4xl mb-1.5 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                      {item.icon}
                    </div>
                    <div className="text-white font-black text-xs text-center px-2 leading-tight">
                      {item.title}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>

        {/* عرض الموبايل (Grid منظم) */}
        <div className="md:hidden grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`
                bg-gradient-to-br ${item.color}
                p-4 
                rounded-2xl 
                shadow-lg 
                active:scale-95 
                transition-all
                text-right
                flex items-center gap-3
              `}
            >
              <div className="text-3xl shrink-0">{item.icon}</div>
              <div className="text-white font-black text-xs">{item.title}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}