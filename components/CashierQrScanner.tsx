'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, QrCode, ShieldCheck, X, AlertTriangle, Sun } from 'lucide-react';

interface CashierQrScannerProps {
  title: string;
  subtitle: string;
  accentColor?: 'sky' | 'amber' | 'emerald';
  isOnline: boolean;
  onTokenScanned: (token: string) => Promise<void> | void;
  onDemoScanQr?: () => Promise<{ ok: boolean; qrToken?: string; error?: string }>;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export default function CashierQrScanner({
  title,
  subtitle,
  accentColor = 'sky',
  isOnline,
  onTokenScanned,
  onDemoScanQr,
}: CashierQrScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraEngine, setCameraEngine] = useState<'BarcodeDetector' | 'ZXing' | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const handledRef = useRef(false);

  const stopCamera = async () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
    setCameraOpen(false);
    setCameraEngine(null);
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  const handleDetectedToken = async (raw: string) => {
    const clean = raw.trim();
    if (!clean || handledRef.current) return;
    handledRef.current = true;
    await stopCamera();
    await onTokenScanned(clean);
  };

  const startCamera = async () => {
    setScannerError('');
    handledRef.current = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScannerError('المتصفح الحالي لا يدعم الوصول للكاميرا. يمكنك لصق رمز البطاقة أدناه أو استخدام المسح التجريبي.');
      return;
    }

    try {
      // Request Wake Lock to prevent screen sleep during scanning
      const navWithWake = navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (navWithWake.wakeLock?.request) {
        try {
          wakeLockRef.current = await navWithWake.wakeLock.request('screen');
          setWakeLockActive(true);
        } catch {
          setWakeLockActive(false);
        }
      }

      setCameraOpen(true);

      // Prefer native BarcodeDetector when available
      if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setCameraEngine('BarcodeDetector');

          const scanLoop = async () => {
            if (!videoRef.current || handledRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const barcodes = await detector.detect(videoRef.current);
                const firstValue = barcodes[0]?.rawValue;
                if (firstValue) {
                  await handleDetectedToken(firstValue);
                  return;
                }
              }
            } catch {
              // Continue scanning frames
            }
            rafRef.current = requestAnimationFrame(() => {
              void scanLoop();
            });
          };
          rafRef.current = requestAnimationFrame(() => {
            void scanLoop();
          });
          return;
        } catch {
          // Fall through to @zxing/browser fallback
        }
      }

      // Automatic fallback to @zxing/browser
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const codeReader = new BrowserQRCodeReader();
      setCameraEngine('ZXing');
      if (!videoRef.current) {
        throw new Error('عنصر الفيديو غير جاهز.');
      }
      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result && !handledRef.current) {
            void handleDetectedToken(result.getText());
          }
        }
      );
      zxingControlsRef.current = controls;
    } catch {
      await stopCamera();
      setScannerError('تعذر تشغيل الكاميرا أو لم يُمنح الإذن. استخدم المسح التجريبي أو الإدخال اليدوي لرمز البطاقة.');
    }
  };

  const handleDemoClick = async () => {
    if (!onDemoScanQr) return;
    setScannerError('');
    setBusy(true);
    const res = await onDemoScanQr();
    setBusy(false);
    if (!res.ok || !res.qrToken) {
      setScannerError(res.error || 'تعذر قراءة رمز QR التجريبي.');
      return;
    }
    await onTokenScanned(res.qrToken);
  };

  const boxTheme =
    accentColor === 'amber'
      ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
      : accentColor === 'emerald'
        ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
        : 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/50';

  const iconColor =
    accentColor === 'amber'
      ? 'text-amber-600'
      : accentColor === 'emerald'
        ? 'text-emerald-600'
        : 'text-sky-600';

  return (
    <div className={`${boxTheme} border p-6 rounded-3xl text-center space-y-5`}>
      <div className={`w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center mx-auto ${iconColor}`}>
        <QrCode className="w-9 h-9" />
      </div>

      <div className="space-y-1.5">
        <h4 className="font-black text-slate-900 dark:text-white text-lg">{title}</h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{subtitle}</p>
      </div>

      {cameraOpen && (
        <div className="max-w-md mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 border-sky-400/60 shadow-2xl relative">
          <video ref={videoRef} className="w-full h-60 object-cover" muted playsInline />
          <div className="p-3 bg-slate-900/95 flex items-center justify-between gap-2 text-xs text-white">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>محرك المسح: {cameraEngine || 'كاميرا'}</span>
              {wakeLockActive && (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md">
                  <Sun className="w-3 h-3" />
                  منع النوم مفعل
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="min-h-[48px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      )}

      {scannerError && (
        <div className="max-w-md mx-auto bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 text-right">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{scannerError}</span>
        </div>
      )}

      {/* Primary Camera Scan + Online Demo Scan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-lg mx-auto">
        {!cameraOpen && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="min-h-[52px] px-6 py-3 bg-[#0B1F3A] hover:bg-[#10325E] text-white font-black rounded-2xl shadow-md inline-flex items-center justify-center gap-2 text-sm"
          >
            <Camera className="w-5 h-5 text-[#00C2FF]" />
            <span>فتح الكاميرا للمسح</span>
          </button>
        )}

        {onDemoScanQr && isOnline && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDemoClick()}
            className="min-h-[52px] px-6 py-3 bg-gradient-electric text-white font-black rounded-2xl shadow-md inline-flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            <QrCode className="w-5 h-5" />
            <span>{busy ? 'جاري المسح...' : 'مسح QR العميل (جاهز)'}</span>
          </button>
        )}
      </div>

      {/* Manual AP1 Token Entry (>= 48px touch targets) */}
      <div className="max-w-lg mx-auto flex flex-col sm:flex-row gap-2.5 pt-1">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="أو الصق رمز بطاقة العميل الرقمية يدوياً (يعمل بدون إنترنت)"
          dir="ltr"
          className="min-h-[48px] flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono"
        />
        <button
          type="button"
          disabled={!manualInput.trim()}
          onClick={() => void onTokenScanned(manualInput.trim())}
          className="min-h-[48px] px-6 py-3 bg-gradient-gold-cta text-[#0B1F3A] font-black rounded-2xl text-xs disabled:opacity-40"
        >
          اعتماد الرمز
        </button>
      </div>
    </div>
  );
}
