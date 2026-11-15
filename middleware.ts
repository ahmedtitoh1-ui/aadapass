import { NextRequest, NextResponse } from 'next/server';
import {
  detectCurrencyFromCountry,
  PREFERRED_CURRENCY_COOKIE,
  SupportedPricingCurrency,
} from './lib/pricingPlans';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Admin RBAC route protection
  if (pathname.startsWith('/admin')) {
    const adminRole = req.cookies.get('admin_role')?.value || 'SUPER_ADMIN';
    if (adminRole === 'SUPPORT_AGENT' && (pathname.includes('settings') || pathname.includes('team'))) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.searchParams.set('unauthorized', '1');
      return NextResponse.redirect(url);
    }
  }

  const existingPreferred = req.cookies.get(PREFERRED_CURRENCY_COOKIE)?.value as
    | SupportedPricingCurrency
    | undefined;

  if (existingPreferred === 'EGP' || existingPreferred === 'SAR') {
    res.headers.set('x-detected-currency', existingPreferred);
    return res;
  }

  const countryHeader =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-appengine-country') ||
    req.headers.get('x-country-code');

  const detected = detectCurrencyFromCountry(countryHeader);
  res.headers.set('x-detected-currency', detected);

  if (countryHeader) {
    res.cookies.set('detected_country', countryHeader.toUpperCase(), {
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });
  }

  res.cookies.set('detected_currency', detected, {
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  });

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
