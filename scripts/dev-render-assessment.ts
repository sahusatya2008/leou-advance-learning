import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const html = await (await fetch(`${BASE}/admin/assessments`, { headers: { Cookie: cookie } })).text();
  console.log('/admin/assessments:', html.includes('Assessments') && html.includes('New Assessment') ? 'ok' : 'FAIL', html.includes('500') && !html.includes('Admin') ? ' (error page)' : '');
  const b = await (await fetch(`${BASE}/api/admin/assessments`, { headers: { Cookie: cookie } })).json();
  if (b.assessments[0]) {
    const d = await (await fetch(`${BASE}/admin/assessments/${b.assessments[0].id}`, { headers: { Cookie: cookie } })).text();
    console.log(`/admin/assessments/${b.assessments[0].id}:`, d.includes('Submissions') ? 'ok' : 'FAIL');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
