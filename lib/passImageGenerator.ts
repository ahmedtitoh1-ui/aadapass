import QRCode from 'qrcode';
import { CustomerCard, DigitalVoucher } from '@/lib/types';

export type PassVisualThemeId =
  | 'auto'
  | 'royal_navy'
  | 'gold_vip'
  | 'emerald_luxury'
  | 'espresso_warm'
  | 'crimson_velvet'
  | 'obsidian_platinum';

export interface PassVisualThemePreset {
  id: PassVisualThemeId;
  label: string;
  swatchHex: string;
  stops: [string, string, string];
  accentHex: string;
}

export const PASS_THEME_PRESETS: PassVisualThemePreset[] = [
  {
    id: 'auto',
    label: 'تلقائي (هوية المتجر)',
    swatchHex: '#0284C7',
    stops: ['#0B1F3A', '#132E57', '#1E3A8A'],
    accentHex: '#FBBF24',
  },
  {
    id: 'royal_navy',
    label: 'كحلي ملكي',
    swatchHex: '#0B1F3A',
    stops: ['#0B1F3A', '#132E57', '#1E3A8A'],
    accentHex: '#00C2FF',
  },
  {
    id: 'gold_vip',
    label: 'ذهبي إمبراطوري VIP',
    swatchHex: '#D97706',
    stops: ['#1E1B4B', '#311042', '#78350F'],
    accentHex: '#FBBF24',
  },
  {
    id: 'emerald_luxury',
    label: 'زمردي فاخر',
    swatchHex: '#047857',
    stops: ['#064E3B', '#047857', '#0F172A'],
    accentHex: '#34D399',
  },
  {
    id: 'espresso_warm',
    label: 'قهوة مختصة محمصة',
    swatchHex: '#78350F',
    stops: ['#451A03', '#78350F', '#1C1917'],
    accentHex: '#FDE68A',
  },
  {
    id: 'crimson_velvet',
    label: 'ياقوتي مخملي',
    swatchHex: '#BE123C',
    stops: ['#881337', '#BE123C', '#18181B'],
    accentHex: '#FDA4AF',
  },
  {
    id: 'obsidian_platinum',
    label: 'أسود بلاتيني',
    swatchHex: '#18181B',
    stops: ['#09090B', '#18181B', '#27272A'],
    accentHex: '#FBBF24',
  },
];

export interface PassDownloadOptions {
  kind: 'store_stamps' | 'store_points' | 'account_master' | 'voucher';
  storeName: string;
  badgeLabel: string;
  holderName: string;
  primaryValue: string;
  secondaryLabel: string;
  rewardText: string;
  codeText: string;
  qrPayload: string;
  accentGradient?: string;
  themeId?: PassVisualThemeId;
  stampsCurrent?: number;
  stampsTarget?: number;
  expiryText?: string;
  wifiPassword?: string;
  cityText?: string;
}

function resolveCanvasGradientStops(
  gradientStr?: string,
  themeId?: PassVisualThemeId
): { stops: [string, string, string]; accentHex: string } {
  if (themeId && themeId !== 'auto') {
    const found = PASS_THEME_PRESETS.find((t) => t.id === themeId);
    if (found) {
      return { stops: found.stops, accentHex: found.accentHex };
    }
  }
  const raw = (gradientStr || '').trim();
  if (raw.startsWith('custom:')) {
    const parts = raw.slice('custom:'.length).split(':').filter(Boolean);
    if (parts.length >= 2) {
      return {
        stops: [parts[0], parts[1], parts[2] || parts[1]],
        accentHex: '#FBBF24',
      };
    }
    if (parts.length === 1) {
      return { stops: [parts[0], parts[0], '#0B1F3A'], accentHex: '#FBBF24' };
    }
  }
  const s = raw.toLowerCase();
  if (s.includes('amber-800') || s.includes('amber-900') || s.includes('stone-900')) {
    return { stops: ['#451A03', '#78350F', '#1C1917'], accentHex: '#FDE68A' };
  }
  if (s.includes('emerald') || s.includes('teal') || s.includes('lime')) {
    return { stops: ['#064E3B', '#047857', '#0F172A'], accentHex: '#34D399' };
  }
  if (s.includes('rose') || s.includes('pink')) {
    return { stops: ['#881337', '#BE123C', '#3B0764'], accentHex: '#FDA4AF' };
  }
  if (s.includes('red-600') || s.includes('orange-600')) {
    return { stops: ['#7F1D1D', '#B91C1C', '#1C1917'], accentHex: '#FBBF24' };
  }
  if (s.includes('purple') || s.includes('indigo') || s.includes('violet')) {
    return { stops: ['#3B0764', '#4338CA', '#0F172A'], accentHex: '#C4B5FD' };
  }
  if (s.includes('zinc-900') || s.includes('obsidian') || s.includes('neutral-900') || s.includes('slate-700')) {
    return { stops: ['#09090B', '#18181B', '#27272A'], accentHex: '#FBBF24' };
  }
  if (s.includes('amber-400') || s.includes('yellow-500')) {
    return { stops: ['#92400E', '#D97706', '#451A03'], accentHex: '#FEF08A' };
  }
  return { stops: ['#0B1F3A', '#132E57', '#1E3A8A'], accentHex: '#FBBF24' };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export async function generatePassDataUrl(options: PassDownloadOptions): Promise<string> {
  const width = 920;
  const height = 1420;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Outer dark studio backdrop
  ctx.fillStyle = '#060D1A';
  ctx.fillRect(0, 0, width, height);

  // Main pass body
  const cardX = 44;
  const cardY = 44;
  const cardW = width - 88;
  const cardH = height - 88;

  const { stops, accentHex } = resolveCanvasGradientStops(options.accentGradient, options.themeId);
  const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.52, stops[1]);
  grad.addColorStop(1, stops[2]);

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle decorative luxury pattern rings
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let r = 80; r <= 480; r += 65) {
    ctx.beginPath();
    ctx.arc(cardX + cardW - 60, cardY + 60, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Pass border
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.stroke();

  // Top perforation notch (Apple/Google Wallet aesthetic)
  ctx.fillStyle = '#060D1A';
  ctx.beginPath();
  ctx.arc(width / 2, cardY, 26, 0, Math.PI);
  ctx.fill();

  // Top Header Bar
  ctx.textAlign = 'right';
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
  ctx.fillText('AADA PASS • بطاقة محفظة رقمية ذكية', width - 92, 118);

  // Badge pill on top-left
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  drawRoundedRect(ctx, 88, 86, 285, 48, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Tahoma, Arial, sans-serif';
  ctx.fillText(options.badgeLabel, 88 + 142, 117);

  // Store / Pass Title
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px Tahoma, Arial, sans-serif';
  ctx.fillText(options.storeName, width - 92, 190);

  // Holder Name + City
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '24px Tahoma, Arial, sans-serif';
  const holderLine = options.cityText
    ? `العميل: ${options.holderName}  •  ${options.cityText}`
    : `العميل: ${options.holderName}`;
  ctx.fillText(holderLine, width - 92, 234);

  // Balance / Value Panel
  drawRoundedRect(ctx, 88, 270, width - 176, 200, 34);
  ctx.fillStyle = 'rgba(7, 16, 33, 0.44)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 25px Tahoma, Arial, sans-serif';
  ctx.fillText(options.secondaryLabel, width - 125, 325);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px Tahoma, Arial, sans-serif';
  ctx.fillText(options.primaryValue, width - 125, 405);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '22px Tahoma, Arial, sans-serif';
  ctx.fillText(options.rewardText.slice(0, 62), width - 125, 448);

  // Stamp circles visual if store_stamps
  let nextY = 505;
  if (options.kind === 'store_stamps' && options.stampsTarget && options.stampsTarget > 0) {
    const total = Math.min(12, options.stampsTarget);
    const current = Math.min(total, options.stampsCurrent || 0);
    const boxW = width - 176;
    drawRoundedRect(ctx, 88, nextY, boxW, 130, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    const step = boxW / (total + 1);
    for (let i = 0; i < total; i++) {
      const cx = width - 88 - step * (i + 1);
      const cy = nextY + 65;
      ctx.beginPath();
      ctx.arc(cx, cy, 29, 0, Math.PI * 2);
      if (i < current) {
        ctx.fillStyle = accentHex;
        ctx.fill();
        ctx.fillStyle = '#0B1F3A';
        ctx.font = 'bold 26px Tahoma, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', cx, cy + 9);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.38)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Tahoma, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), cx, cy + 7);
      }
    }
    nextY += 160;
  } else {
    // Progress / Perks strip for Points, Account Master, or Voucher
    const boxW = width - 176;
    drawRoundedRect(ctx, 88, nextY, boxW, 96, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Tahoma, Arial, sans-serif';
    const perkLabel =
      options.kind === 'account_master'
        ? '✦ صالحة لمشاركة النقاط مع المتاجر الشريكة أو الإهداء الفوري أو قسائم الخصم'
        : options.kind === 'voucher'
        ? '✦ إبراز هذه القسيمة للكاشير يطبق الخصم مباشرة على فاتورتك'
        : '✦ اجمع النقاط مع كل زيارة واستبدلها بمكافآت وقسائم فورية';
    ctx.fillText(perkLabel, width - 120, nextY + 56);
    nextY += 126;
  }

  // White QR Verification Container
  const qrBoxH = 540;
  drawRoundedRect(ctx, 88, nextY, width - 176, qrBoxH, 38);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Generate QR Data URL
  const qrDataUrl = await QRCode.toDataURL(options.qrPayload || options.codeText, {
    width: 350,
    margin: 1,
    color: {
      dark: '#0B1F3A',
      light: '#FFFFFF',
    },
  });

  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });

  const qrSize = 330;
  ctx.drawImage(qrImg, (width - qrSize) / 2, nextY + 32, qrSize, qrSize);

  // Code pill below QR
  drawRoundedRect(ctx, 180, nextY + 378, width - 360, 56, 18);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0B1F3A';
  ctx.font = 'bold 27px Courier, monospace';
  ctx.fillText(options.codeText, width / 2, nextY + 415);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 21px Tahoma, Arial, sans-serif';
  ctx.fillText(
    'امسح الرمز لدى الكاشير لإضافة/صرف النقاط أو تفعيل القسيمة فوراً',
    width / 2,
    nextY + 472
  );

  if (options.expiryText || options.wifiPassword) {
    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 20px Tahoma, Arial, sans-serif';
    const extra = [
      options.expiryText ? `الصلاحية: ${options.expiryText}` : '',
      options.wifiPassword ? `واي فاي المتجر: ${options.wifiPassword}` : '',
    ]
      .filter(Boolean)
      .join('   •   ');
    ctx.fillText(extra, width / 2, nextY + 512);
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = '20px Tahoma, Arial, sans-serif';
  ctx.fillText(
    'Aada Pass Digital Wallet  •  جاهزة للحفظ في الهاتف والعمل بدون إنترنت',
    width / 2,
    height - 74
  );

  return canvas.toDataURL('image/png');
}

export function buildCardPassOptions(
  card: CustomerCard,
  holderName: string,
  qrToken: string,
  wifiPassword?: string,
  themeId: PassVisualThemeId = 'auto'
): PassDownloadOptions {
  const isStamps = card.rule.type === 'stamps';
  const target = isStamps
    ? card.rule.stampsRequired || 6
    : card.rule.rewardTargetPoints || 100;

  return {
    kind: isStamps ? 'store_stamps' : 'store_points',
    storeName: card.storeName,
    badgeLabel: isStamps ? 'بطاقة أختام متجر' : 'بطاقة نقاط متجر',
    holderName,
    primaryValue: isStamps
      ? `${card.currentBalance} / ${target} أختام`
      : `${card.currentBalance} نقطة`,
    secondaryLabel: isStamps ? 'سجل الأختام الحالي' : 'رصيد النقاط المتاح بالمتجر',
    rewardText: card.rule.rewardDescription || 'مكافأة حصرية عند اكتمال الهدف',
    codeText: `AADA-${card.storeId.toUpperCase()}-${card.currentBalance}`,
    qrPayload: qrToken,
    accentGradient: card.cardColor,
    themeId,
    stampsCurrent: isStamps ? card.currentBalance : undefined,
    stampsTarget: isStamps ? target : undefined,
    wifiPassword,
  };
}

export function buildAccountCardPassOptions(params: {
  holderName: string;
  username: string;
  accountPoints: number;
  totalStorePoints: number;
  qrToken: string;
  referralCode: string;
  themeId?: PassVisualThemeId;
}): PassDownloadOptions {
  return {
    kind: 'account_master',
    storeName: 'بطاقة الحساب الشاملة — Aada Pass VIP',
    badgeLabel: 'بطاقة الحساب والهدايا',
    holderName: params.holderName,
    primaryValue: `${params.accountPoints} نقطة حساب`,
    secondaryLabel: `إجمالي نقاط المتاجر: ${params.totalStorePoints} نقطة`,
    rewardText: 'نقاط حرة للمشاركة مع المتاجر أو إهدائها لحسابات أخرى أو خصم فوري',
    codeText: `AADA-VIP-${params.referralCode || params.username.toUpperCase()}`,
    qrPayload: params.qrToken,
    accentGradient: 'from-[#0B1F3A] via-[#132E57] to-[#1E3A8A]',
    themeId: params.themeId || 'gold_vip',
    expiryText: 'عضوية دائمة شاملة',
  };
}

export function buildVoucherPassOptions(
  voucher: DigitalVoucher,
  holderName: string,
  themeId: PassVisualThemeId = 'emerald_luxury'
): PassDownloadOptions {
  const currencyLabel = voucher.currency === 'EGP' ? 'ج.م' : 'ر.س';
  return {
    kind: 'voucher',
    storeName: voucher.storeName,
    badgeLabel: 'قسيمة خصم رقمية',
    holderName,
    primaryValue: `${voucher.valueAmount} ${currencyLabel}`,
    secondaryLabel: voucher.title,
    rewardText: `مقابل ${voucher.pointsCost} نقطة — صالحة للاستخدام المباشر لدى الكاشير`,
    codeText: voucher.code,
    qrPayload: voucher.code,
    accentGradient: 'from-emerald-700 via-teal-800 to-slate-900',
    themeId,
    expiryText: voucher.expiresAt,
  };
}
