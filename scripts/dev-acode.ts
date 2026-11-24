import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { issueAccessCode } from '../src/services/accessCodeService';

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const username = process.argv[2] ?? 'smokestudent';
  const st = await db.user.findUniqueOrThrow({ where: { username } });
  const code = await issueAccessCode(st.id);
  console.log('CODE=' + code.code);
  process.exit(0);
}
main();
