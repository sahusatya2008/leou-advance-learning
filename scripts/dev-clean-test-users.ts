import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const like = ['smoke', 'dassign', 'shell', 'render', 'adminmake'];
  const r = await db.user.deleteMany({ where: { OR: like.map((u) => ({ username: { startsWith: u } })) } });
  console.log('removed users:', r.count);
  process.exit(0);
}
main();
