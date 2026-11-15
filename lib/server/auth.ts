import type { SessionUser, UserRole } from '@/lib/types';

export function maskPhone(phone?: string): string {
  if (!phone) return '05****0000';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '****';
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-2)}`;
}

export function maskEmail(email?: string): string {
  if (!email) return '***@aadapass.com';
  const [local, domain] = email.split('@');
  if (!domain) return '***@aadapass.com';
  return `${(local || 'u').slice(0, 2)}***@${domain}`;
}

export function maskCommercialReg(reg?: string): string {
  if (!reg) return '1010****00';
  if (reg.length <= 4) return '****';
  return `${reg.slice(0, 2)}****${reg.slice(-2)}`;
}

export function hasRole(user: SessionUser | null | undefined, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
