import { NextRequest, NextResponse } from 'next/server';
import { enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'cashier.manifest');
  if (!guard.ok) return guard.response;

  return NextResponse.json(
    {
      name: 'كاشير عادة باس | Aada Pass POS',
      short_name: 'كاشير عادة',
      description: 'تطبيق الكاشير السريع لنقاط البيع — تسجيل الفواتير أوفلاين وصرف المكافآت أونلاين.',
      start_url: '/cashier',
      scope: '/cashier',
      display: 'standalone',
      dir: 'rtl',
      lang: 'ar',
      orientation: 'any',
      background_color: '#f4f8fe',
      theme_color: '#0B1F3A',
      categories: ['business', 'finance'],
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
