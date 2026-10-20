import { createDatabase } from './index.js';
import { seedDatabase } from './seed.js';
const db = createDatabase();
try {
  await seedDatabase(db, process.env.ADMIN_EMAIL ?? '', process.env.ADMIN_PASSWORD ?? '');
  console.log(
    'Administrator and demo catalog ready. Existing passwords and products were not changed.',
  );
} finally {
  await db.$disconnect();
}
