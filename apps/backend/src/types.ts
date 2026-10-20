import type { HttpBindings } from '@hono/node-server';
import type { Database, User } from '@app/database';
export type ApiEnv = { Variables: { user: User | null }; Bindings: Partial<HttpBindings> };
export type ApiOptions = { db: Database; secret: string; origins: string[]; verifyUrl: string; orderWaitMs?: number; secureCookies?: boolean };
