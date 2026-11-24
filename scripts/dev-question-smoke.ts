import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const j = (o: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(o) });

  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const cid = cls.id, sid = cls.subjects[0].id;

  const mk = { classRoomId: cid, subjectId: sid, difficulty: 'MEDIUM', stem: 'Smoke Q ' + Date.now() };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['MCQ', { ...mk, type: 'MCQ', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] }],
    ['SHORT', { ...mk, type: 'SHORT', explanation: 'explain step by step' }],
    ['CODING', { ...mk, type: 'CODING', allowedLanguages: ['python', 'java'],
      starterCode: { python: 'def solve():\n    pass', java: 'class M{ public static void main(String[] a){} }' },
      solutionCode: 'def solve():\n    return 1',
      testCases: [{ input: '1', expected: '1', isHidden: false, weight: 1 }] }],
    ['SQL', { ...mk, type: 'SQL', sqlDialect: 'PostgreSQL', sqlSchemaSql: 'CREATE TABLE t (id INT);', sqlSeedSql: '', sqlExpectedResult: [{ id: 1 }], sqlComparisonMode: 'UNORDERED' }],
    ['ORAL', { ...mk, type: 'ORAL' }],
    ['UPLOAD', { ...mk, type: 'UPLOAD' }],
  ];
  for (const [t, payload] of cases) {
    const r = await fetch(`${BASE}/api/admin/questions`, j(payload));
    const b = await r.json();
    console.log(`create ${t}: ${r.status} ${r.ok ? 'ok' : JSON.stringify(b)}`);
  }
  // invalid MCQ (no correct)
  const bad = await fetch(`${BASE}/api/admin/questions`, j({ ...mk, type: 'MCQ', options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }] }));
  console.log('invalid MCQ (no correct):', bad.status);
  // patch + delete the coding one
  const list = await (await fetch(`${BASE}/api/admin/questions?type=CODING`, { headers: { Cookie: cookie } })).json();
  const coding = list.questions.find((x: { stem: string }) => x.stem.includes('Smoke Q'));
  const p = await fetch(`${BASE}/api/admin/questions/${coding.id}`, j({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'def solve(): pass' }, solutionCode: 'x', testCases: [{ input: '', expected: '2', isHidden: true, weight: 2 }] }));
  console.log('patch CODING:', p.status);
  const d = await fetch(`${BASE}/api/admin/questions/${coding.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  console.log('delete CODING:', d.status);
}
main().catch((e) => { console.error(e); process.exit(1); });
