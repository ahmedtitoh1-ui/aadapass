'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PublicLanding from '@/components/PublicLanding';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import AuthModal from '@/components/AuthModal';
import CustomerPortal from '@/components/CustomerPortal';
import MerchantPortal from '@/components/MerchantPortal';
import MerchantRegistrationScreen from '@/components/MerchantRegistrationScreen';
import Navbar from '@/components/Navbar';
import {
  INITIAL_CUSTOMER,
  INITIAL_NETWORK_RULES,
  INITIAL_PACKAGES,
  INITIAL_SITE_SETTINGS,
  INITIAL_STORES,
  INITIAL_TICKETS,
  INITIAL_TRANSACTIONS,
} from '@/lib/mockData';
import type {
  CustomerProfile,
  NetworkRules,
  SessionUser,
  SiteSettings,
  Store,
  SubscriptionPackage,
  SubscriptionPlanName,
  SupportTicket,
  Transaction,
  UserRole,
} from '@/lib/types';
import {
  detectCurrencyFromCountry,
  PREFERRED_CURRENCY_COOKIE,
  SupportedPricingCurrency,
} from '@/lib/pricingPlans';
import { readCookieValue, savePreferredCurrencyCookie } from '@/components/CurrencySwitcher';
import {
  authFetch,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '@/lib/clientAuth';
import { scrollToSectionById } from '@/lib/scrollToSection';

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [activePortalMode, setActivePortalMode] = useState<'public' | 'portal'>('portal');
  const [activePublicPage, setActivePublicPage] = useState<'home' | 'merchant' | 'visitor'>('home');
  const [isRegisterScreenOpen, setIsRegisterScreenOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [currency, setCurrency] = useState<SupportedPricingCurrency>('EGP');
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [packages, setPackages] = useState<SubscriptionPackage[]>(INITIAL_PACKAGES);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [customer, setCustomer] = useState<CustomerProfile>(INITIAL_CUSTOMER);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [networkRules, setNetworkRules] = useState<NetworkRules>(INITIAL_NETWORK_RULES);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRoleHint, setAuthRoleHint] = useState<UserRole | undefined>(undefined);
  const [authInitialMode, setAuthInitialMode] = useState<
    'login' | 'register_merchant' | 'register_customer'
  >('login');
  const [authDefaultPlan, setAuthDefaultPlan] = useState<SubscriptionPlanName>('Starter');
  const [authInitialIdentifier, setAuthInitialIdentifier] = useState<string | undefined>(undefined);
  const [authEnvSlug, setAuthEnvSlug] = useState<string | undefined>(undefined);

  const loadInitialState = useCallback(async () => {
    try {
      const hasToken = Boolean(getStoredAccessToken());
      const [publicRes, sessionRes] = await Promise.all([
        fetch('/api/stores', { cache: 'no-store' }).catch(() => null),
        hasToken
          ? Promise.resolve(null)
          : authFetch('/api/auth/session', { cache: 'no-store' }).catch(() => null),
      ]);

      if (publicRes && publicRes.ok) {
        const pubData = await publicRes.json().catch(() => ({}));
        if (Array.isArray(pubData.stores) && pubData.stores.length > 0) {
          setStores(pubData.stores);
        }
        if (Array.isArray(pubData.packages)) {
          setPackages(pubData.packages);
        }
        if (pubData.siteSettings) {
          setSiteSettings(pubData.siteSettings);
        }
      }

      let isAuthenticated = hasToken;
      if (!isAuthenticated && sessionRes && sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => ({}));
        isAuthenticated = Boolean(sessionData?.authenticated);
      }

      if (isAuthenticated) {
        const meRes = await authFetch('/api/me', { cache: 'no-store' }).catch(() => null);
        if (meRes && meRes.ok) {
          const data = await meRes.json().catch(() => ({}));
          if (data.user) setCurrentUser(data.user);
          if (Array.isArray(data.stores) && data.stores.length > 0) setStores(data.stores);
          if (Array.isArray(data.packages)) setPackages(data.packages);
          if (data.siteSettings) setSiteSettings(data.siteSettings);
          if (data.customer) setCustomer(data.customer);
          if (Array.isArray(data.transactions)) setTransactions(data.transactions);
          if (Array.isArray(data.tickets)) setTickets(data.tickets);
          if (data.networkRules) setNetworkRules(data.networkRules);
        }
      }
    } catch {
      // Keep fallback seed state for public visitors
    }
  }, []);

  const handleCurrencyChange = useCallback((next: SupportedPricingCurrency) => {
    savePreferredCurrencyCookie(next);
    setCurrency(next);
  }, []);

  useEffect(() => {
    const saved = readCookieValue(PREFERRED_CURRENCY_COOKIE);
    if (saved === 'EGP' || saved === 'SAR') {
      setCurrency(saved);
    } else {
      const detectedCountry = readCookieValue('detected_country');
      const detectedCurrency = readCookieValue('detected_currency');
      if (detectedCountry) {
        setCurrency(detectCurrencyFromCountry(detectedCountry));
      } else if (detectedCurrency === 'EGP' || detectedCurrency === 'SAR') {
        setCurrency(detectedCurrency);
      }
    }
    loadInitialState();
  }, [loadInitialState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get('section');
    const authParam = params.get('auth');
    const loginParam = params.get('login');
    const registerParam = params.get('register');
    const planParam = params.get('plan') as SubscriptionPlanName | null;
    const portalParam = params.get('portal');
    const envParam = params.get('env');
    const userParam = params.get('user');

    // Strip any stale #pricing / #section hash on homepage load so browser never auto-scrolls while waiting
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    if (portalParam === '1') {
      setActivePortalMode('portal');
      setIsRegisterScreenOpen(false);
    }

    if (registerParam === '1') {
      if (planParam) setAuthDefaultPlan(planParam);
      setIsRegisterScreenOpen(true);
      return;
    }

    if (requestedSection) {
      params.delete('section');
      const qs = params.toString();
      const nextUrl = window.location.pathname + (qs ? `?${qs}` : '');
      window.history.replaceState(null, '', nextUrl);
      window.requestAnimationFrame(() => {
        scrollToSectionById(requestedSection);
      });
    } else if (window.scrollY > 0 && !authParam && !loginParam) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    if (loginParam === 'merchant') {
      setAuthRoleHint('MERCHANT_OWNER');
      setAuthEnvSlug(envParam || undefined);
      setAuthInitialIdentifier(userParam || undefined);
      setAuthModalOpen(true);
    } else if (authParam === 'customer') {
      setAuthRoleHint('CUSTOMER');
      setAuthModalOpen(true);
    } else if (authParam === '1') {
      setAuthRoleHint(undefined);
      setAuthModalOpen(true);
    }
  }, []);

  const handleOpenAuth = (
    roleHint?: UserRole,
    options?: {
      mode?: 'login' | 'register_merchant' | 'register_customer';
      planName?: SubscriptionPlanName;
    }
  ) => {
    if (options?.mode === 'register_merchant') {
      setAuthDefaultPlan(options?.planName || 'Growth');
      setAuthModalOpen(false);
      setIsRegisterScreenOpen(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    setAuthRoleHint(roleHint);
    setAuthInitialMode(options?.mode === 'register_customer' ? 'register_customer' : 'login');
    setAuthDefaultPlan(options?.planName || 'Starter');
    setAuthEnvSlug(undefined);
    setAuthInitialIdentifier(undefined);
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredAccessToken();
    setCurrentUser(null);
  };

  const handleLogoutAll = async () => {
    await authFetch('/api/auth/logout-all', { method: 'POST' }).catch(() => {});
    clearStoredAccessToken();
    setCurrentUser(null);
  };

  const handleWelcomePass = async (name = 'زائر عادة باس', phone = '0551234567') => {
    const res = await fetch('/api/auth/welcome-pass', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'تعذر إصدار البطاقة الفورية' };
    }
    if (data.accessToken) {
      setStoredAccessToken(data.accessToken);
    }
    if (data.user) {
      setCurrentUser(data.user);
      setActivePortalMode('portal');
    }
    if (data.customer) setCustomer(data.customer);
    return { ok: true };
  };

  const handleRequestAddStore = async (storeName: string, city?: string) => {
    await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_addition',
        storeName,
        city: city || 'الرياض',
        category: 'كافيه',
      }),
    }).catch(() => {});
  };

  if (isRegisterScreenOpen) {
    return (
      <div dir="rtl" className={isDark ? 'dark' : ''}>
        <MerchantRegistrationScreen
          initialPlan={authDefaultPlan}
          initialAccountType="MERCHANT_OWNER"
          selectedCountryCurrency={currency}
          packages={packages}
          annualDiscountPercent={siteSettings.annualDiscountPct ?? 20}
          adminWhatsappNumber={siteSettings.adminWhatsappNumber || '966500000000'}
          trialDaysConfig={siteSettings.trialDays ?? 14}
          onBackToHome={() => setIsRegisterScreenOpen(false)}
          onSwitchToLogin={() => {
            setIsRegisterScreenOpen(false);
            setAuthInitialMode('login');
            setAuthModalOpen(true);
          }}
          onRegistrationComplete={(user, accessToken, createdStore) => {
            if (accessToken) setStoredAccessToken(accessToken);
            if (createdStore) {
              setStores((prev) => {
                const filtered = prev.filter((s) => s.merchantId !== createdStore.merchantId);
                return [createdStore, ...filtered];
              });
            }
            setIsRegisterScreenOpen(false);
            setCurrentUser(user);
            setActivePortalMode('portal');
            loadInitialState();
          }}
        />
      </div>
    );
  }

  if (
    activePortalMode === 'portal' &&
    (currentUser?.role === 'MERCHANT_OWNER' || currentUser?.role === 'MERCHANT_MANAGER')
  ) {
    const activeStore =
      stores.find((s) => s.merchantId === currentUser.merchantId) || stores[0];
    return (
      <div dir="rtl" className={`min-h-screen bg-slate-50 ${isDark ? 'dark' : ''}`}>
        <Navbar
          sessionUser={currentUser}
          activePortalMode={activePortalMode}
          isDark={isDark}
          onToggleDark={() => setIsDark((prev) => !prev)}
          onShowPublic={() => setActivePortalMode('public')}
          onShowPortal={() => setActivePortalMode('portal')}
          onOpenAuthModal={(roleHint, opts) =>
            handleOpenAuth(roleHint, { mode: opts?.mode, planName: opts?.plan })
          }
          onLogout={handleLogout}
          onLogoutAll={handleLogoutAll}
        />
        <MerchantPortal
          sessionUser={currentUser}
          store={activeStore}
          packages={packages}
          transactions={transactions.filter((t) => t.merchantId === activeStore.merchantId)}
          tickets={tickets}
          adminWhatsappNumber={siteSettings.adminWhatsappNumber}
          onRefreshDashboard={loadInitialState}
          onUpdateStore={async (updated) => {
            setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            await authFetch(`/api/stores/${updated.merchantId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            }).catch(() => {});
          }}
          onAddTicket={async (payload) => {
            const res = await authFetch('/api/tickets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const d = await res.json().catch(() => ({}));
            if (d.ticket) setTickets((prev) => [d.ticket, ...prev]);
          }}
          onLogoutAll={handleLogoutAll}
        />
      </div>
    );
  }

  if (activePortalMode === 'portal' && currentUser?.role === 'CUSTOMER') {
    return (
      <div dir="rtl" className={`min-h-screen bg-slate-50 ${isDark ? 'dark' : ''}`}>
        <Navbar
          sessionUser={currentUser}
          activePortalMode={activePortalMode}
          isDark={isDark}
          onToggleDark={() => setIsDark((prev) => !prev)}
          onShowPublic={() => setActivePortalMode('public')}
          onShowPortal={() => setActivePortalMode('portal')}
          onOpenAuthModal={(roleHint, opts) =>
            handleOpenAuth(roleHint, { mode: opts?.mode, planName: opts?.plan })
          }
          onLogout={handleLogout}
          onLogoutAll={handleLogoutAll}
        />
        <CustomerPortal
          customer={customer}
          stores={stores}
          transactions={transactions.filter((t) => t.customerId === customer.id)}
          tickets={tickets}
          networkRules={networkRules}
          onOpenStore={() => router.push('/stores')}
          onUpdateCustomer={async (patch) => {
            const res = await authFetch('/api/customer/wallet', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            });
            const d = await res.json().catch(() => ({}));
            if (d.customer) setCustomer(d.customer);
            return {
              ok: res.ok,
              sessionRevoked: Boolean(d.sessionRevoked),
              message: d.message,
              error: d.error,
            };
          }}
          onRedeemVoucher={async (payload) => {
            const res = await authFetch('/api/customer/vouchers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const d = await res.json().catch(() => ({}));
            if (d.customer) setCustomer(d.customer);
            return {
              ok: res.ok,
              error: d.error,
              requiresPhoneVerification: d.requiresPhoneVerification,
              requiresSecondConfirmation: d.requiresSecondConfirmation,
              voucher: d.voucher,
            };
          }}
          onChangePassword={async (currentPassword, newPassword) => {
            const res = await authFetch('/api/customer/account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            const d = await res.json().catch(() => ({}));
            return { ok: res.ok, error: d.error };
          }}
          onAnonymizeAccount={async () => {
            const res = await authFetch('/api/customer/account', { method: 'DELETE' });
            const d = await res.json().catch(() => ({}));
            if (res.ok) setCurrentUser(null);
            return { ok: res.ok, error: d.error };
          }}
          onAddTicket={async (payload) => {
            const res = await authFetch('/api/tickets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const d = await res.json().catch(() => ({}));
            if (d.ticket) setTickets((prev) => [d.ticket, ...prev]);
          }}
          onLogoutAll={handleLogoutAll}
        />
      </div>
    );
  }

  return (
    <div dir="rtl" id="top" className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 ${isDark ? 'dark' : ''}`}>
      <AnnouncementBanner
        isBannerActive={siteSettings.isBannerActive}
        bannerText={siteSettings.bannerText}
        bannerLinkUrl={siteSettings.bannerLinkUrl}
        bannerColor={siteSettings.bannerColor}
        announcements={siteSettings.announcements}
      />
      <Navbar
        sessionUser={currentUser}
        activePortalMode="public"
        activePublicPage={activePublicPage}
        onNavigatePublicPage={(page, anchorId) => {
          setActivePublicPage(page);
          if (anchorId) {
            setTimeout(() => scrollToSectionById(anchorId), 60);
          } else if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        isDark={isDark}
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        onToggleDark={() => setIsDark((prev) => !prev)}
        onShowPublic={() => setActivePortalMode('public')}
        onShowPortal={() => setActivePortalMode('portal')}
        onOpenAuthModal={(roleHint, opts) =>
          handleOpenAuth(roleHint, { mode: opts?.mode, planName: opts?.plan })
        }
        onLogout={handleLogout}
        onLogoutAll={handleLogoutAll}
      />
      <PublicLanding
        stores={stores}
        packages={packages}
        siteSettings={siteSettings}
        currency={currency}
        activePublicPage={activePublicPage}
        onNavigatePublicPage={(page, anchorId) => {
          setActivePublicPage(page);
          if (anchorId) {
            setTimeout(() => scrollToSectionById(anchorId), 60);
          } else if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onCurrencyChange={handleCurrencyChange}
        onOpenAuthModal={(roleHint, options) => {
          if (roleHint === 'PLATFORM_ADMIN') {
            router.push('/admin');
            return;
          }
          handleOpenAuth(roleHint, options);
        }}
        onRequestAddStore={handleRequestAddStore}
        onWelcomePass={handleWelcomePass}
      />
      <AuthModal
        isOpen={authModalOpen}
        initialRoleHint={authRoleHint}
        initialMode={authInitialMode}
        initialIdentifier={authInitialIdentifier}
        environmentSlug={authEnvSlug}
        defaultPlan={authDefaultPlan}
        defaultCurrency={currency}
        trialDays={siteSettings.trialDays ?? 14}
        onOpenFullRegister={(plan) => {
          setAuthDefaultPlan(plan || 'Growth');
          setAuthModalOpen(false);
          setIsRegisterScreenOpen(true);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthEnvSlug(undefined);
          setAuthInitialIdentifier(undefined);
        }}
        onSuccess={(user, accessToken, createdStore) => {
          if (accessToken) setStoredAccessToken(accessToken);
          if (createdStore) {
            setStores((prev) => {
              const filtered = prev.filter((s) => s.merchantId !== createdStore.merchantId);
              return [createdStore, ...filtered];
            });
          }
          setCurrentUser(user);
          setActivePortalMode('portal');
          setIsRegisterScreenOpen(false);
          loadInitialState();
          if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') {
            router.push('/admin');
          } else if (user.role === 'CASHIER') {
            router.push('/cashier');
          }
        }}
      />
    </div>
  );
}

