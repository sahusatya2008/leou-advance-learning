import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const H = (m: string, o: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(o) });

  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const br = await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: cookie } })).json();
  const batchId = br.classroom.batches[0].id;

  // seed 2 questions (MCQ + SQL) for the assessment
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'Asm Q ' + Date.now() };
  const mq = (await fetch(`${BASE}/api/admin/questions`, H('POST', { ...mk, type: 'MCQ', options: [{ text: 'x', isCorrect: true }, { text: 'y', isCorrect: false }] }))).json();
  const sq = (await fetch(`${BASE}/api/admin/questions`, H('POST', { ...mk, type: 'SQL', sqlDialect: 'PostgreSQL', sqlSchemaSql: 'CREATE TABLE t(id INT);', sqlExpectedResult: [], sqlComparisonMode: 'UNORDERED' }))).json();
  const [mqd, sqd] = await Promise.all([mq, sq]);
  const qs = [{ questionId: mqd.question.id, marks: 2 }, { questionId: sqd.question.id, marks: 3 }];

  // create ASSIGNMENT (open, no window)
  const r = await fetch(`${BASE}/api/admin/assessments`, H('POST', { batchId, kind: 'ASSIGNMENT', title: 'Smoke Assignment', durationMinutes: 60, instructions: 'Do it', shuffleQuestions: true, questions: qs }));
  const b = await r.json();
  const aid = b.assessment?.id;
  console.log('create:', r.status, 'marks', b.assessment?.totalMarks, 'status', b.assessment?.status);

  // invalid: empty questions
  const bad = await fetch(`${BASE}/api/admin/assessments`, H('POST', { batchId, kind: 'MOCK', title: 'Bad', durationMinutes: 30, questions: [] }));
  console.log('empty questions (expect 400):', bad.status);

  // schedule with future start
  const future = new Date(Date.now() + 3600e3).toISOString();
  const p1 = await fetch(`${BASE}/api/admin/assessments/${aid}`, H('PATCH', { ...qs, batchId, kind: 'ASSIGNMENT', title: 'Smoke Assignment', durationMinutes: 60, startsAt: future, shuffleQuestions: false, questions: qs }));
  console.log('patch schedule:', p1.status, (await p1.json()).assessment?.status);

  // publish → CLOSED flow
  const tr = (s: string) => fetch(`${BASE}/api/admin/assessments/${aid}`, H('PATCH', { status: s }));
  console.log('-> RELEASED:', (await tr('RELEASED')).status);
  console.log('-> CLOSED:', (await tr('CLOSED')).status);

  // delete
  const d = await fetch(`${BASE}/api/admin/assessments/${aid}`, { method: 'DELETE', headers: { Cookie: cookie } });
  console.log('delete:', d.status);

  // cleanup questions
  await fetch(`${BASE}/api/admin/questions/${mqd.question.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  await fetch(`${BASE}/api/admin/questions/${sqd.question.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
