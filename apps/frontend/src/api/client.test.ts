import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, get, post } from './client';

describe('klient API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('wysyła JSON metodą POST pod /api', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 1 }, { status: 201 }));
    vi.stubGlobal('fetch', fetch);

    await expect(post('orders', { a: 1 })).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it('zamienia odpowiedź z błędem na ApiError z komunikatem serwera', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Brak uprawnień.' }, { status: 403 })),
    );

    const error = await get('licenses').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Brak uprawnień.', status: 403 });
  });

  it('zgłasza brak połączenia z serwerem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(get('products')).rejects.toMatchObject({
      message: 'Brak połączenia z serwerem.',
      status: 0,
    });
  });
});
