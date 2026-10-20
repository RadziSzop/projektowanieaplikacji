import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { loginSchema, registerSchema } from '@app/contracts';
import { hashPassword, verifyPassword, tokenHash } from '@app/database';
import type { ApiEnv, ApiOptions } from './types.js';

export function requireUser(c: Context<ApiEnv>) {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'Zaloguj się.' });
  return user;
}
export function requireAdmin(c: Context<ApiEnv>) {
  const user = requireUser(c);
  if (user.role !== 'ADMIN') throw new HTTPException(403, { message: 'Brak uprawnień.' });
  return user;
}
export function installSecurity(app: Hono<ApiEnv>, options: ApiOptions) {
  const limits = new Map<string, { count: number; until: number }>();
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const origin = c.req.header('origin');
      if ((origin && !options.origins.includes(origin)) || c.req.header('sec-fetch-site') === 'cross-site') throw new HTTPException(403, { message: 'Niedozwolone źródło żądania.' });
      if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('content-type') ?? '')) throw new HTTPException(415, { message: 'Wymagany JSON.' });
    }
    if (['/api/login', '/api/register', '/api/licenses/verify'].includes(c.req.path) && c.req.method === 'POST') {
      const now = Date.now();
      for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
      const key = `${c.env?.incoming?.socket.remoteAddress ?? 'local'}:${c.req.path}`;
      const current = limits.get(key) ?? { count: 0, until: now + 60_000 };
      if (++current.count > (c.req.path.endsWith('/verify') ? 100 : 20) || limits.size >= 10000) throw new HTTPException(429, { message: 'Zbyt wiele prób. Spróbuj później.' });
      limits.set(key, current);
    }
    let user = null;
    const token = getCookie(c, 'session');
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const session = await options.db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
      if (session && !session.revokedAt && session.expiresAt > new Date() && !session.user.disabledAt) user = session.user;
    }
    c.set('user', user);
    await next();
  });
}
export function registerAuth(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db } = options;
  app.get('/api/me', (c) => { const user = c.get('user'); return c.json(user ? { name: user.name, email: user.email } : null); });
  app.post('/api/register', async (c) => {
    const data = registerSchema.parse(await c.req.json());
    await db.user.create({ data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password) } });
    return c.json({ message: 'Konto utworzone. Możesz się zalogować.' }, 201);
  });
  app.post('/api/login', async (c) => {
    const data = loginSchema.parse(await c.req.json());
    const user = await db.user.findUnique({ where: { email: data.email } });
    const correct = await verifyPassword(data.password, user?.passwordHash ?? '');
    if (!user || user.disabledAt || !correct) throw new HTTPException(401, { message: 'Nieprawidłowy e-mail lub hasło.' });
    const token = randomBytes(32).toString('hex');
    await db.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    setCookie(c, 'session', token, { httpOnly: true, sameSite: 'Lax', secure: options.secureCookies ?? false, path: '/', maxAge: 7 * 86400 });
    return c.json({ name: user.name, email: user.email });
  });
  app.post('/api/logout', async (c) => {
    const token = getCookie(c, 'session');
    if (token) await db.session.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
    deleteCookie(c, 'session', { path: '/', secure: options.secureCookies ?? false });
    return c.json({ message: 'Wylogowano.' });
  });
}
