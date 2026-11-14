import { randomBytes } from 'node:crypto';
import type { z, loginSchema, registerSchema } from '@app/contracts';
import { hashPassword, verifyPassword, tokenHash, type Database } from '@app/database';

export const SESSION_DAYS = 7;

export async function register(db: Database, data: z.infer<typeof registerSchema>) {
  await db.user.create({ data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password) } });
}

// Returns null for any failure so callers can't distinguish "no user" from "bad password".
export async function login(db: Database, data: z.infer<typeof loginSchema>) {
  const user = await db.user.findUnique({ where: { email: data.email } });
  const correct = await verifyPassword(data.password, user?.passwordHash ?? '');
  if (!user || user.disabledAt || !correct) return null;
  const token = randomBytes(32).toString('hex');
  await db.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
  return { user, token };
}

export async function logout(db: Database, token: string) {
  await db.session.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function sessionUser(db: Database, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  return session && !session.revokedAt && session.expiresAt > new Date() && !session.user.disabledAt ? session.user : null;
}
