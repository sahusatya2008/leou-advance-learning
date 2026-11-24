import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const res = await fetch(`${BASE}/admin/questions`, { headers: { Cookie: cookie } });
  const html = await res.text();
  console.log('status:', res.status);
  console.log('has Bank:', html.includes('Question Bank'), 'has New:', html.includes('New Question'), 'has Filter:', html.includes('All types'));
}
main().catch((e) => { console.error(e); process.exit(1); });
