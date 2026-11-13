import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { loginSchema, registerSchema } from '@app/contracts';
import { login, logout, register, sessionUser, SESSION_DAYS } from '../services/auth.js';
import type { ApiEnv, ApiOptions } from '../types.js';

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
    const token = getCookie(c, 'session');
    c.set('user', token ? await sessionUser(options.db, token) : null);
    await next();
  });
}
export function registerAuth(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db } = options;
  app.get('/api/me', (c) => { const user = c.get('user'); return c.json(user ? { name: user.name, email: user.email } : null); });
  app.post('/api/register', async (c) => {
    await register(db, registerSchema.parse(await c.req.json()));
    return c.json({ message: 'Konto utworzone. Możesz się zalogować.' }, 201);
  });
  app.post('/api/login', async (c) => {
    const session = await login(db, loginSchema.parse(await c.req.json()));
    if (!session) throw new HTTPException(401, { message: 'Nieprawidłowy e-mail lub hasło.' });
    const { user, token } = session;
    setCookie(c, 'session', token, { httpOnly: true, sameSite: 'Lax', secure: options.secureCookies ?? false, path: '/', maxAge: SESSION_DAYS * 86400 });
    return c.json({ name: user.name, email: user.email });
  });
  app.post('/api/logout', async (c) => {
    const token = getCookie(c, 'session');
    if (token) await logout(db, token);
    deleteCookie(c, 'session', { path: '/', secure: options.secureCookies ?? false });
    return c.json({ message: 'Wylogowano.' });
  });
}
