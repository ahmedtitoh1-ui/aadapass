import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'كاشير عادة باس | Aada Pass POS',
  description: 'بوابة الكاشير المستقلة (PWA) لتسجيل الفواتير أوفلاين وصرف المكافآت أونلاين.',
  manifest: '/cashier/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'كاشير عادة',
  },
};

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
