import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'public.config');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const prodEnv = db.environments.find((e) => e.id === 'env-prod') || db.environments[0];
  return NextResponse.json({
    platformName: db.adminSecurity.platformName,
    defaultCurrency: db.adminSecurity.defaultCurrency,
    featureFlags: db.featureFlags,
    networkRules: db.networkRules,
    packages: db.packages,
    siteSettings: db.siteSettings,
    activeEnvironment: prodEnv
      ? {
          id: prodEnv.id,
          name: prodEnv.name,
          isActive: prodEnv.isActive,
          maintenanceMode: prodEnv.maintenanceMode,
          allowPublicRegistration: prodEnv.allowPublicRegistration,
        }
      : null,
  });
}
