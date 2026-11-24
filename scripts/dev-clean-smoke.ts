import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  await db.user.deleteMany({ where: { username: { in: ['smokestudent'] } } });
  console.log('smoke student removed');
  process.exit(0);
}
main();
