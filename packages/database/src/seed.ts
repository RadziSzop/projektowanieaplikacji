import { configSchema, emailSchema } from '@app/contracts';
import { type Database, hashPassword } from './index.js';
export async function seedDatabase(db: Database, email: string, password: string) {
  email = emailSchema.parse(email);
  if (password.length < 12 || password.length > 128)
    throw new Error('ADMIN_PASSWORD must contain 12–128 characters');
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN')
    throw new Error('Refusing to promote an existing public account');
  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Administrator',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  });
  for (const [index, name] of ['Standard', 'Plus', 'Pro'].entries()) {
    const product = await db.product.findUnique({ where: { name } });
    if (product) continue;
    await db.$transaction(async (tx) => {
      const config = await tx.config.create({
        data: { name: `Nova ${name}`, createdById: admin.id },
      });
      const version = await tx.configVersion.create({
        data: {
          configId: config.id,
          version: 1,
          ...configSchema.parse({ validityDays: index === 2 ? null : 365 * (index + 1) }),
        },
      });
      await tx.product.create({
        data: {
          name,
          description: `Licencja Nova ${name}`,
          price: [4900, 9900, 19900][index],
          features: [
            'Klucz dostarczany e-mailem',
            index === 2 ? 'Licencja bezterminowa' : `Ważność: ${365 * (index + 1)} dni`,
          ],
          configVersionId: version.id,
        },
      });
    });
  }
}
