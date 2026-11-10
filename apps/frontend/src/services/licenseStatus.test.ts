import { describe, expect, it } from 'vitest';
import { licenseState } from './licenseStatus';

const now = new Date('2026-11-11T12:00:00Z');
const license = { id: '1', key: 'NOVA-TEST', expiresAt: null, revokedAt: null };

describe('licenseState', () => {
  it('rozpoznaje licencję aktywną, wygasłą i unieważnioną', () => {
    expect(licenseState(license, now)).toBe('active');
    expect(licenseState({ ...license, expiresAt: '2027-01-01T00:00:00Z' }, now)).toBe('active');
    expect(licenseState({ ...license, expiresAt: '2026-01-01T00:00:00Z' }, now)).toBe('expired');
    expect(
      licenseState(
        { ...license, expiresAt: '2026-01-01T00:00:00Z', revokedAt: '2025-12-01T00:00:00Z' },
        now,
      ),
    ).toBe('revoked');
  });
});
