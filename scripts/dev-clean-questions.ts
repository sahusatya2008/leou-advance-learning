import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const r = await db.question.deleteMany({ where: { OR: [{ stem: { startsWith: 'Smoke Q' } }, { stem: { startsWith: 'Patch Smoke' } }] } });
  console.log('removed questions:', r.count);
  process.exit(0);
}
main();
