import type { License } from '../types';

export type LicenseState = 'active' | 'expired' | 'revoked';

export function licenseState(license: License, now = new Date()): LicenseState {
  if (license.revokedAt) return 'revoked';
  if (license.expiresAt && new Date(license.expiresAt) <= now) return 'expired';
  return 'active';
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pl-PL');
}
