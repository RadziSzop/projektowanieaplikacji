import express, { type ErrorRequestHandler } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const db = new PrismaClient();
const deriveKey = promisify(scrypt);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (req.method !== 'GET' && origin && new URL(origin).host !== req.get('host')) {
    res.status(403).json({ error: 'Niedozwolone źródło żądania.' }); return;
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
app.get('/api/products', async (_req, res) => res.json(await db.product.findMany({ orderBy: { id: 'asc' } })));

app.post('/api/register', async (req, res) => {
  const name = text(req.body.name, 80), email = text(req.body.email).toLowerCase();
  const password = req.body.password;
  if (!name || !emailValid(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Podaj imię, poprawny e-mail i hasło od 8 do 128 znaków.' }); return;
  }
  const salt = randomBytes(16).toString('hex');
  const hash = (await deriveKey(password, salt, 64) as Buffer).toString('hex');
  await db.user.create({ data: { name, email, password: `${salt}:${hash}` } });
  res.status(201).json({ message: 'Konto utworzone. Możesz się zalogować.' });
});

app.post('/api/login', async (req, res) => {
  const user = await db.user.findUnique({ where: { email: text(req.body.email).toLowerCase() } });
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const [salt, saved] = user?.password.split(':') ?? ['empty', '00'.repeat(64)];
  const hash = await deriveKey(password.slice(0, 128), salt, 64) as Buffer;
  if (!user || !timingSafeEqual(hash, Buffer.from(saved, 'hex'))) {
    res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło.' }); return;
  }
  const token = randomBytes(32).toString('hex');
  await db.user.update({ where: { id: user.id }, data: { session: digest(token), sessionUntil: new Date(Date.now() + 86400000) } });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 86400000 });
  res.json({ name: user.name, email: user.email });
});

app.get('/api/me', async (req, res) => {
  const token = req.headers.cookie?.split('; ').find(c => c.startsWith('session='))?.slice(8);
  const user = token ? await db.user.findUnique({ where: { session: digest(token) } }) : null;
  res.json(user?.sessionUntil && user.sessionUntil > new Date() ? { name: user.name, email: user.email } : null);
});
app.post('/api/logout', async (req, res) => {
  const token = req.headers.cookie?.split('; ').find(c => c.startsWith('session='))?.slice(8);
  if (token) await db.user.updateMany({ where: { session: digest(token) }, data: { session: null, sessionUntil: null } });
  res.clearCookie('session').json({ message: 'Wylogowano.' });
});

app.post('/api/orders', async (req, res) => {
  const name = text(req.body.name, 80), email = text(req.body.email).toLowerCase();
  const address = text(req.body.address), city = text(req.body.city, 80), postcode = text(req.body.postcode, 6);
  const cart: unknown = req.body.items;
  if (!name || !emailValid(email) || !address || !city || !/^\d{2}-\d{3}$/.test(postcode) || !Array.isArray(cart) || !cart.length || cart.length > 3) {
    res.status(400).json({ error: 'Uzupełnij dane zamówienia i dodaj produkt do koszyka.' }); return;
  }
  const products = await db.product.findMany();
  const ids = new Set<number>();
  const items: { name: string; quantity: number; price: number; keys: string[] }[] = [];
  for (const item of cart) {
    const product = products.find(p => p.id === item?.id);
    if (!product || ids.has(product.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      res.status(400).json({ error: 'Nieprawidłowa zawartość koszyka (maksymalnie 10 sztuk produktu).' }); return;
    }
    ids.add(product.id);
    items.push({ name: product.name, quantity: item.quantity, price: product.price, keys: Array.from({ length: item.quantity }, () => `DEMO-${randomBytes(8).toString('hex').toUpperCase()}`) });
  }
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = await db.order.create({ data: { name, email, address, city, postcode, total, items } });
  res.status(201).json({ id: order.id, items, total });
});

app.use((_req, res) => { res.status(404).json({ error: 'Nie znaleziono strony.' }); });
app.use(((error, _req, res, _next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ error: 'Konto z tym adresem e-mail już istnieje.' }); return;
  }
  if (error instanceof SyntaxError) { res.status(400).json({ error: 'Nieprawidłowe dane.' }); return; }
  console.error(error);
  res.status(500).json({ error: 'Błąd serwera. Spróbuj ponownie.' });
}) as ErrorRequestHandler);
