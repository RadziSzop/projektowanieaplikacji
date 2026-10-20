import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/client.js';
export { Prisma, PrismaClient };
export type { GenerationJob, Delivery, User, ConfigVersion, License } from './generated/client.js';
export * from './password.js';
export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Prisma.TransactionClient;
export function createDatabase(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error('DATABASE_URL is required');
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 8,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    }),
  });
}
