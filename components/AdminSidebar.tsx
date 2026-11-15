'use client';

import React from 'react';
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Eye,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  Network,
  Paintbrush,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: 'SUPER_ADMIN' | 'SUPPORT_AGENT';
  adminName: string;
  onLogout: () => void;
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  role,
  adminName,
  onLogout,
}: AdminSidebarProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const menuItems = [
    {
      id: 'overview',
      label: 'لوحة القيادة والمؤشرات',
      icon: LayoutDashboard,
      description: 'ملخص الأداء والمبيعات',
      superAdminOnly: false,
    },
    {
      id: 'environments',
      label: 'إدارة البيئات والتشغيل',
      icon: Layers,
      description: 'إنشاء وتفعيل وقفل البيئات',
      superAdminOnly: true,
    },
    {
      id: 'visitors',
      label: 'متابعة العملاء والزوار',
      icon: Eye,
      description: 'الزيارات الحية وملفات العملاء',
      superAdminOnly: false,
    },
    {
      id: 'reports',
      label: 'التقارير والإحصائيات',
      icon: BarChart3,
      description: 'رسوم بيانية وتصدير Excel',
      superAdminOnly: false,
    },
    {
      id: 'landing-settings',
      label: 'مصمم الصفحة الرئيسية',
      icon: Paintbrush,
      description: 'تعديل الصور والأقسام والإعلانات',
      superAdminOnly: true,
    },
    {
      id: 'packages',
      label: 'إدارة الباقات والأسعار',
      icon: CreditCard,
      description: 'التحكم في الظهور للرئيسية والمتاجر',
      superAdminOnly: false,
    },
    {
      id: 'support',
      label: 'التذاكر والدعم والمنازعات',
      icon: Headphones,
      description: 'خدمة العملاء والقيود العكسية',
      superAdminOnly: false,
    },
    {
      id: 'stores',
      label: 'إدارة المتاجر والاشتراكات',
      icon: Store,
      description: 'التفعيل وتوثيق الملكية',
      superAdminOnly: false,
    },
    {
      id: 'users',
      label: 'إدارة المستخدمين والصلاحيات',
      icon: Users,
      description: 'الحسابات والأدوار والأمان',
      superAdminOnly: false,
    },
    {
      id: 'network',
      label: 'الشبكة المشتركة والتسويات',
      icon: Network,
      description: 'تسويات النقاط والمنازعات',
      superAdminOnly: false,
    },
    {
      id: 'security',
      label: 'إعدادات المنصة والتدقيق',
      icon: ShieldCheck,
      description: 'تفعيل الميزات وسجل الرقابة',
      superAdminOnly: true,
    },
  ];

  return (
    <aside className="w-full lg:w-72 glass-card border-l border-sky-100 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 lg:min-h-screen">
      <div className="space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo-color.png"
              alt="عادة باس | Aada Pass"
              className="h-9 w-auto object-contain dark:hidden shrink-0"
            />
            <img
              src="/logo-white.png"
              alt="عادة باس | Aada Pass"
              className="h-9 w-auto object-contain hidden dark:block shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-[#0B1F3A] dark:text-white truncate">
                عادة باس
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">
                الإدارة والدعم الموحد
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
              isSuperAdmin
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30'
                : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30'
            }`}
          >
            {isSuperAdmin ? 'مدير النظام الشامل' : 'دعم ومتابعة'}
          </span>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-right group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800/70 hover:text-[#0284C7] dark:hover:text-[#00C2FF]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                      isActive
                        ? 'bg-[#0B1F3A]/10 text-[#0B1F3A]'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-[#0284C7] dark:group-hover:text-[#00C2FF]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-black truncate">{item.label}</span>
                    <span
                      className={`block text-[10px] truncate ${
                        isActive ? 'text-[#0B1F3A]/75 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
                      }`}
                    >
                      {item.description}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive
                      ? 'text-[#0B1F3A] rotate-180'
                      : 'text-slate-400 dark:text-slate-600 group-hover:-translate-x-0.5'
                  }`}
                />
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="pt-5 mt-6 border-t border-slate-200/80 dark:border-slate-700/60 space-y-3">
        <div className="bg-gradient-navy text-white p-4 rounded-2xl space-y-2 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <img
              src="/logo-white.png"
              alt="Aada Pass"
              className="h-5 w-auto object-contain opacity-90"
            />
            <span className="text-[10px] font-black text-[#FBBF24]">
              {isSuperAdmin ? 'إدارة + دعم شامل' : 'دعم العملاء'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-black text-[#FBBF24] shrink-0">
              {adminName?.[0] || 'ع'}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-black text-white truncate">
                {adminName || 'مدير النظام'}
              </span>
              <span className="block text-[10px] text-sky-200/80">
                منصة عادة باس المركزية
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 text-xs font-bold transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
