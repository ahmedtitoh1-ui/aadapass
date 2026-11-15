import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/server/db';
import { findStoreBySlugOrId, toPublicStoreDto } from '@/lib/server/publicDto';
import PublicSubpageHeader from '@/components/PublicSubpageHeader';
import PublicFooter from '@/components/PublicFooter';
import StoreBranchesMap from '@/components/StoreBranchesMap';
import PublicStoreActions from '@/components/PublicStoreActions';
import InteractiveStoreMenu from '@/components/InteractiveStoreMenu';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Instagram,
  MapPin,
  Phone,
  Star,
  Store as StoreIcon,
  Wifi,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const found = findStoreBySlugOrId(db.stores, slug);
  if (!found) {
    return {
      title: 'متجر غير مسجل | Aada Pass',
      description: 'لم يتم تسجيل هذا المتجر في دليل Aada Pass حالياً.',
    };
  }
  const dto = toPublicStoreDto(found);
  return {
    title: `${dto.name} (${dto.category} في ${dto.city}) | Aada Pass`,
    description: `${dto.description} تعرف على الفروع، الأسعار، المنيو الرقمي، العروض، وبطاقة الولاء في ${dto.city} - ${dto.area}.`,
    openGraph: {
      title: `${dto.name} | Aada Pass - عادة باس`,
      description: dto.description,
      type: 'website',
    },
  };
}

export default async function PublicStoreDetailPage({ params }: StorePageProps) {
  const { slug } = await params;
  const db = getDb();
  const found = findStoreBySlugOrId(db.stores, slug);

  if (!found) {
    notFound();
  }

  const store = toPublicStoreDto(found);
  const baseUrl = process.env.APP_URL || 'https://aadapass.sa';
  const allMenuItems = [
    ...store.activeOffers,
    ...store.menu.filter(
      (m) => !store.activeOffers.some((o) => o.name === m.name)
    ),
  ];

  const firstBranch = store.branches[0];
  const crowdStatus =
    firstBranch?.crowdLevel === 'هادئ'
      ? { label: 'هادئ الآن', cls: 'bg-emerald-500 text-white' }
      : firstBranch?.crowdLevel === 'متوسط'
      ? { label: 'ازدحام متوسط', cls: 'bg-amber-400 text-[#0B1F3A]' }
      : { label: 'مزدحم', cls: 'bg-rose-500 text-white' };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    description: store.description,
    telephone: store.phone,
    url: `${baseUrl}/stores/${encodeURIComponent(store.slug)}`,
    image: store.cover,
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address,
      addressLocality: store.city,
      addressRegion: store.area,
    },
  };

  return (
    <div dir="rtl" className="min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicSubpageHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/stores"
            className="inline-flex items-center gap-1.5 text-xs font-black text-sky-700 dark:text-[#00C2FF] hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى دليل المتاجر</span>
          </Link>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            بروفايل المتجر الرسمي والمنيو الرقمي التفاعلي
          </span>
        </div>

        {/* Luxury Store Profile Hero Card */}
        <section className="glass-card rounded-3xl overflow-hidden shadow-xl">
          <div className="relative h-64 sm:h-80 bg-[#0B1F3A]">
            <img
              src={store.cover}
              alt={store.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/45 to-transparent" />

            {/* Top Status Badges */}
            <div className="absolute top-4 right-5 left-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-[#0B1F3A]/85 backdrop-blur-md text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-black flex items-center gap-1.5">
                  <StoreIcon className="w-3.5 h-3.5" />
                  <span>{store.category}</span>
                </span>
                {store.isTrial ? (
                  <span className="px-3 py-1.5 rounded-full bg-amber-300 text-[#0B1F3A] text-xs font-black flex items-center gap-1 shadow-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>فترة تجربة تمهيدية</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-amber-400 text-[#0B1F3A] text-xs font-black flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>علامة تجارية موثقة</span>
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[#FBBF24] border border-white/20 text-xs font-black flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>4.9</span>
                </span>
              </div>

              <span className={`px-3.5 py-1.5 rounded-full text-xs font-black shadow-md ${crowdStatus.cls}`}>
                ● حالة الفرع: {crowdStatus.label}
              </span>
            </div>

            {/* Store Identity Overlay */}
            <div className="absolute bottom-5 right-6 left-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <img
                  src={store.logo}
                  alt={store.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-white shadow-2xl bg-white shrink-0"
                />
                <div className="text-white space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-sky-200 font-bold">
                    <span>📍 {store.city} — {store.area}</span>
                    <span aria-hidden="true">·</span>
                    <span>{store.branches.length} {store.branches.length === 1 ? 'فرع معتمد' : 'فروع معتمدة'}</span>
                    <span aria-hidden="true">·</span>
                    <span>العملة: {store.currency === 'SAR' ? 'ريال سعودي (SAR)' : 'جنيه مصري (EGP)'}</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{store.name}</h1>
                  <p className="text-xs sm:text-sm text-slate-200 font-medium">{store.address}</p>
                </div>
              </div>

              {store.isViewerOnly && (
                <span className="bg-amber-400 text-[#0B1F3A] text-xs font-black px-3.5 py-1.5 rounded-xl self-start sm:self-end shrink-0">
                  تواجد رقمي ومنيو (بدون نقاط)
                </span>
              )}
            </div>
          </div>

          {/* Store Profile Info Strip */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-3">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                نبذة عن {store.name}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {store.description}
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                {found.workingHours && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-1.5 rounded-xl text-xs font-black">
                    <Clock className="w-3.5 h-3.5" />
                    <span>مواعيد العمل: {found.workingHours}</span>
                  </span>
                )}
                {store.wifiPassword && (
                  <span className="inline-flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800/60 px-3.5 py-1.5 rounded-xl text-xs font-black">
                    <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-[#00C2FF]" />
                    <span>واي فاي العملاء: {store.wifiPassword}</span>
                  </span>
                )}
                {store.instagramUrl && (
                  <a
                    href={store.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/60 px-3.5 py-1.5 rounded-xl text-xs font-black text-pink-700 dark:text-pink-300 hover:underline"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>انستغرام المتجر ↗</span>
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50/90 dark:bg-slate-800/70 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row lg:flex-col justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xs font-black text-slate-400 uppercase">التواصل السريع والاتجاهات</h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                  تواصل مباشرة مع الفرع أو افتح الموقع على خرائط جوجل
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`tel:${store.phone}`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center justify-center gap-2 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span className="font-mono" dir="ltr">
                    {store.phone}
                  </span>
                </a>
                <a
                  href={store.googleMapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-sky-50 text-[#0B1F3A] dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-[#00C2FF]" />
                  <span>خرائط جوجل</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Loyalty Card Wallet Pass Action + Photo Menu Gallery */}
        <section className="glass-card rounded-3xl p-6 sm:p-8">
          <PublicStoreActions store={store} />
        </section>

        {/* Interactive Visual Digital Menu & Order Loyalty Points Calculator */}
        <section id="digital-menu" className="glass-card rounded-3xl p-6 sm:p-8">
          <InteractiveStoreMenu
            storeName={store.name}
            items={allMenuItems}
            loyaltyRule={found.loyaltyRule}
            isViewerOnly={store.isViewerOnly}
          />
        </section>

        {/* Interactive Leaflet / OpenStreetMap Branches */}
        <section className="glass-card rounded-3xl p-6 sm:p-8">
          <StoreBranchesMap
            storeName={store.name}
            branches={store.branches}
            googleMapLink={store.googleMapLink}
          />
        </section>
      </main>

      <PublicFooter adminWhatsappNumber={db.siteSettings.adminWhatsappNumber} />
    </div>
  );
}
