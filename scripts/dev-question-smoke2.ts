import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'Patch Smoke ' + Date.now() };
  const r = await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'x' }, solutionCode: 'y', testCases: [{ input: '', expected: '1', isHidden: false, weight: 1 }] }) });
  const q = (await r.json()).question;
  const p = await fetch(`${BASE}/api/admin/questions/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'k' }, solutionCode: 'zz', testCases: [{ input: '', expected: '7', isHidden: true, weight: 3 }] }) });
  const pb = await p.json();
  console.log('patch:', p.status, 'lang ok:', pb.question?.allowedLanguages?.[0] === 'python', 'thidden:', pb.question?.testCases?.[0]?.isHidden === true);
  const d = await fetch(`${BASE}/api/admin/questions/${q.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  console.log('delete:', d.status);
}
main().catch((e) => { console.error(e); process.exit(1); });
