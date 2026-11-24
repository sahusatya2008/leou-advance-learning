import 'dotenv/config';
import { Client } from 'pg';
import { hash } from 'bcryptjs';

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const users = await pg.query('SELECT id, username, email, role, "passwordHash" FROM "User" ORDER BY role');
  console.log('BEFORE:');
  users.rows.forEach((u) => console.log(`  ${u.username.padEnd(16)} ${u.email.padEnd(26)} ${u.role.padEnd(8)} ${u.passwordHash.slice(0, 20)}…`));

  const admin = users.rows.find((u) => u.role === 'ADMIN');
  if (admin) {
    const hashed = await hash('admin123', 12);
    await pg.query('UPDATE "User" SET username = $1, email = $1, "passwordHash" = $2 WHERE id = $3', ['admin', hashed, admin.id]);
    console.log('\nUPDATED admin -> username/email "admin", password "admin123"');
  } else {
    console.log('\nNO ADMIN FOUND');
  }
  await pg.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });