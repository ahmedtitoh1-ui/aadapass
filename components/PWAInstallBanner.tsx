'use client';

import React, { useEffect, useState } from 'react';
import { Download, WifiOff, Share, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const syncStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    syncStatus();
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);
    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className={`bg-amber-500 text-[#0B1F3A] font-black text-xs flex items-center justify-center gap-2 ${
        compact ? 'px-3 py-1.5 rounded-full' : 'px-4 py-2.5 rounded-2xl shadow-md border border-amber-300'
      }`}
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>وضع عدم الاتصال نشط — رمز QR المحفوظ محلياً وبطاقاتك جاهزة للعرض عند الكاشير</span>
    </div>
  );
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const timer = setTimeout(() => {
      setIsIos(iosDevice);
      setIsStandalone(standalone);
    }, 0);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (isStandalone) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full text-[11px] font-bold">
        <Smartphone className="w-3.5 h-3.5" />
        <span>مُثبّت كتطبيق ويب (PWA)</span>
      </span>
    );
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowIosGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-4 py-2 rounded-full text-xs shadow-sm transition-all min-h-[40px]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isIos ? 'إضافة للشاشة الرئيسية' : 'تثبيت بطاقة الويب (PWA)'}</span>
      </button>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-sky-100 dark:border-sky-800/40 space-y-4 text-right">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 dark:text-white text-base">تثبيت Aada Pass على جوالك</h4>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              تعمل محفظة <strong>عادة باس</strong> فوراً من المتصفح بدون متجر تطبيقات، ويمكنك تثبيتها على شاشتك الرئيسية للوصول الفوري وعرض رمز QR حتى عند ضعف الشبكة:
            </p>
            <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 space-y-2 text-xs text-slate-800 dark:text-slate-200">
              <p className="flex items-center gap-2 font-bold">
                <Share className="w-4 h-4 text-sky-600 shrink-0" />
                <span>في Safari / iOS: اضغط زر المشاركة أسفل المتصفح ثم اختر &laquo;إضافة إلى الصفحة الرئيسية&raquo;.</span>
              </p>
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                في Chrome / Android: افتح قائمة المتصفح (⋮) واختر &laquo;تثبيت التطبيق&raquo;.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full bg-[#0B1F3A] text-white font-bold py-2.5 rounded-xl text-xs"
            >
              فهمت، إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}
