import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Aada Pass - عادة باس | محفظة الولاء الذكية',
    short_name: 'عادة باس',
    description: 'محفظة بطاقات الولاء والنقاط والأختام الرقمية ودليل المتاجر بدون تحميل تطبيق.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f8fe',
    theme_color: '#007BFF',
    dir: 'rtl',
    lang: 'ar',
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
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
