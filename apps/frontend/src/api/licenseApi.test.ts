import { afterEach, describe, expect, it, vi } from 'vitest';
import { LicenseApi } from './licenseApi';

describe('LicenseApi.verify', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('wysyła klucz w treści żądania, przekazuje signal i zwraca każdy status', async () => {
    const signal = AbortSignal.timeout(6000);
    let status = 'VALID';
    const fetch = vi.fn(async () => Response.json({ status }));
    vi.stubGlobal('fetch', fetch);

    for (status of ['VALID', 'INVALID', 'EXPIRED', 'REVOKED']) {
      await expect(LicenseApi.verify('NOVA-TEST', signal)).resolves.toEqual({ status });
    }
    expect(fetch).toHaveBeenCalledWith('/api/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'NOVA-TEST' }),
      signal,
    });
  });

  it('zgłasza błąd przy niedostępnej usłudze zamiast zwracać nieważną licencję', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'Weryfikacja jest chwilowo niedostępna.' }, { status: 503 }),
      ),
    );
    await expect(LicenseApi.verify('NOVA-TEST')).rejects.toThrow(
      'Weryfikacja jest chwilowo niedostępna.',
    );
  });
});
