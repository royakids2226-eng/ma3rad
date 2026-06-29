import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "./actions"; 
import { authOptions } from "@/auth";
import NotificationBell from "./admin/NotificationBell";
import TestOrderButton from "./TestOrderButton";
import TrialBanner from '@/components/TrialBanner';

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.image) {
    redirect("/login");
  }

  const user = await getCurrentUser(session.user.image as string);
  
  if (!user) {
     redirect("/api/auth/signout");
  }

  const isAllowedInAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'ACCOUNTANT';
  const isTestUser = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden" dir="rtl">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 animate-gradient" />
        
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto mb-6">
          <TrialBanner />
        </div>
        {/* Header */}
        <header className="glass rounded-2xl p-4 md:p-6 mb-8 slide-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl animate-pulse-glow">
                  {session.user?.name?.[0] || 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-900" />
              </div>
              
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">
                  أهلاً، {session.user?.name} 👋
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {user?.role === 'ADMIN' && '🛡️ مدير النظام'}
                  {user?.role === 'OWNER' && '👑 صاحب الشركة'}
                  {user?.role === 'ACCOUNTANT' && '💰 محاسب'}
                  {user?.role === 'EMPLOYEE' && '👤 موظف مبيعات'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {isAllowedInAdmin && <NotificationBell isDark={true} />}
              {isTestUser && <TestOrderButton userId={user.id} />}
              
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className="glass text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <span>⚙️</span>
                  <span>لوحة التحكم</span>
                </Link>
              )}
              
              <Link 
                href="/api/auth/signout" 
                className="bg-red-500/20 text-red-300 text-sm font-bold border border-red-500/30 px-4 py-2 rounded-xl hover:bg-red-500/30 transition-colors flex items-center"
              >
                خروج
              </Link>
            </div>
          </div>
        </header>

        {/* Main Actions Grid */}
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Primary Action - New Order */}
          <div className="scale-in" style={{ animationDelay: '0.1s' }}>
            <Link 
              href="/orders/new" 
              className="action-card block relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 p-8 md:p-10 rounded-3xl shadow-2xl group animate-pulse-glow"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="absolute top-4 left-4 text-6xl opacity-20 animate-float">🛒</div>
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-3xl md:text-4xl font-black text-white mb-2">
                    أوردر جديد
                  </span>
                  <span className="text-blue-100 text-sm md:text-base font-bold">
                    إضافة طلب بيع وكاشير
                  </span>
                </div>
                <div className="bg-white/20 w-20 h-20 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <span className="text-5xl text-white">+</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Orders List */}
            <div className="scale-in" style={{ animationDelay: '0.2s' }}>
              <Link 
                href="/orders/list" 
                className="action-card block glass rounded-2xl p-6 text-center group"
              >
                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <span className="text-3xl">📝</span>
                </div>
                <span className="text-white font-bold text-sm md:text-base">
                  الأوردرات
                </span>
                <div className="text-gray-400 text-xs mt-1">
                  عرض السجل
                </div>
              </Link>
            </div>

            {/* Cash Management */}
            {user?.role !== 'EMPLOYEE' && (
              <div className="scale-in" style={{ animationDelay: '0.3s' }}>
                <Link 
                  href="/payments/new" 
                  className="action-card block glass rounded-2xl p-6 text-center group"
                >
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <span className="text-3xl">💰</span>
                  </div>
                  <span className="text-white font-bold text-sm md:text-base">
                    النقدية
                  </span>
                  <div className="text-gray-400 text-xs mt-1">
                    سندات القبض والصرف
                  </div>
                </Link>
              </div>
            )}

            {/* Returns - NEW */}
            {isAllowedInAdmin && (
              <div className="scale-in" style={{ animationDelay: '0.4s' }}>
                <Link 
                  href="/admin/returns" 
                  className="action-card block glass rounded-2xl p-6 text-center group"
                >
                  <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <span className="text-3xl">↩️</span>
                  </div>
                  <span className="text-white font-bold text-sm md:text-base">
                    المرتجعات
                  </span>
                  <div className="text-gray-400 text-xs mt-1">
                    سجل المرتجعات
                  </div>
                </Link>
              </div>
            )}

            {/* Admin Panel - Only for Admin */}
            {isAdmin && (
              <div className="scale-in" style={{ animationDelay: '0.5s' }}>
                <Link 
                  href="/admin" 
                  className="action-card block glass rounded-2xl p-6 text-center group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="relative z-10">
                    <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <span className="text-3xl">⚙️</span>
                    </div>
                    <span className="text-white font-bold text-sm md:text-base">
                      لوحة التحكم
                    </span>
                    <div className="text-gray-400 text-xs mt-1">
                      إدارة النظام
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-xs font-mono pt-8">
            نظام إدارة المبيعات v2.0 • modoo
          </div>
        </div>
      </div>
    </div>
  );
}