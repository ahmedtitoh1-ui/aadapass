'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicStoreDTO } from '@/lib/types';
import { SMART_PAUSE_NOTICE } from '@/lib/subscriptionStatus';
import { AlertCircle, CheckCircle2, Gift, Image as ImageIcon, Sparkles, Wallet, X } from 'lucide-react';
import confetti from 'canvas-confetti';

import { authFetch, getStoredAccessToken, setStoredAccessToken } from '@/lib/clientAuth';

interface PublicStoreActionsProps {
  store: PublicStoreDTO;
}

export default function PublicStoreActions({ store }: PublicStoreActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const handleJoinClick = async () => {
    if (store.isViewerOnly || store.isTemporarilyPaused) return;
    setBusy(true);
    setFeedback('');

    try {
      let token = getStoredAccessToken();
      if (!token) {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshRes.ok) {
          const sessionData = await refreshRes.json().catch(() => null);
          if (sessionData?.accessToken && sessionData?.user?.role === 'CUSTOMER') {
            token = sessionData.accessToken;
            setStoredAccessToken(token);
          }
        }
      }

      if (!token) {
        router.push(`/?auth=customer&join=${encodeURIComponent(store.slug)}`);
        return;
      }

      const joinRes = await authFetch('/api/customer/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: store.slug }),
      });

      if (joinRes.ok) {
        setJoined(true);
        setFeedback('تمت إضافة البطاقة إلى محفظتك بنجاح!');
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 } });
      } else {
        router.push(`/?auth=customer&join=${encodeURIComponent(store.slug)}`);
      }
    } catch {
      router.push(`/?auth=customer&join=${encodeURIComponent(store.slug)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Loyalty Program Box, Smart Pause Notice, or Viewer Plan Badge */}
      {store.isTemporarilyPaused ? (
        <div className="bg-gradient-to-r from-[#0B1F3A] to-[#10325E] text-white rounded-3xl p-6 sm:p-7 flex items-start gap-4 shadow-lg border border-sky-400/20">
          <div className="w-11 h-11 rounded-2xl bg-sky-400/15 border border-sky-300/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#FBBF24]" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-white text-base sm:text-lg">
                {SMART_PAUSE_NOTICE.customerTitle}
              </h2>
              <span className="text-[11px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full">
                {SMART_PAUSE_NOTICE.badgeLabel}
              </span>
            </div>
            <p className="text-xs text-sky-100/90 leading-relaxed">
              {SMART_PAUSE_NOTICE.customerSubtitle}
            </p>
          </div>
        </div>
      ) : store.isViewerOnly ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-6 flex items-start gap-4">
          <AlertCircle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-amber-900 dark:text-amber-300 text-base">
                لا يشارك في برنامج النقاط
              </h2>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                (عرض تعريفي للخدمات فقط)
              </span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
              هذا المتجر مدرج في دليل Aada Pass لعرض خدماته ومنتجاته وفروعه وبيانات التواصل، ولا يشارك في نظام النقاط أو بطاقات الولاء حالياً.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-navy text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-200">
                <Gift className="w-4 h-4 text-[#FBBF24]" />
                <span>بطاقة الولاء المتاحة</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black">
                {store.loyaltySummary?.rewardDescription}
              </h2>
              <p className="text-xs text-sky-100/90">
                انضم مجاناً واحفظ بطاقتك الرقمية الذكية على الشاشة الرئيسية بدون تحميل تطبيقات. يتطلب تسجيل دخول العميل.
              </p>
              {feedback && (
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{feedback}</span>
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleJoinClick}
              className="bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-6 py-3.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap shrink-0 transition-transform active:scale-95 disabled:opacity-60"
            >
              {joined ? <CheckCircle2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              <span>{joined ? 'مضافة في محفظتك' : busy ? 'جاري التحقق...' : 'إضافة البطاقة / الانضمام'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Store Interior & Decor Photo Gallery ("صور المتجر وديكور المكان") */}
      {store.storeGallery && store.storeGallery.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FBBF24]" />
              <span>صور المتجر وديكور المكان ({store.storeGallery.length})</span>
            </h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              استكشف أجواء وجلسات المكان قبل زيارتك
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {store.storeGallery.map((imgUrl, idx) => (
              <button
                key={`decor-${imgUrl}-${idx}`}
                type="button"
                onClick={() => setLightboxImg(imgUrl)}
                className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs aspect-[4/3] bg-slate-100 dark:bg-slate-800 text-right cursor-pointer"
              >
                <img
                  src={imgUrl}
                  alt={`ديكور وأجواء ${store.name} - صورة ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-2.5 right-2.5 bg-[#0B1F3A]/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-xl">
                  أجواء المكان #{idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photo Menu Gallery ("المنيو كصور") */}
      {store.menuImages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-sky-600" />
            <span>المنيو كصور</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {store.menuImages.map((imgUrl, idx) => (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setLightboxImg(imgUrl)}
                className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs aspect-[16/10] bg-slate-100 dark:bg-slate-800 text-right cursor-pointer"
              >
                <img
                  src={imgUrl}
                  alt={`منيو ${store.name} - صورة ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {store.isNew && (
                  <span className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg border border-white/50">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>جديد</span>
                  </span>
                )}
                <span className="absolute bottom-3 right-3 bg-[#0B1F3A]/85 text-white text-xs font-bold px-3 py-1 rounded-xl">
                  تكبير صورة المنيو {idx + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              className="absolute -top-12 left-0 bg-white text-slate-900 p-2 rounded-full shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImg}
              alt={`صورة منيو ${store.name}`}
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-2xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
