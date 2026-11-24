import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const rep = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => ({})) });
  const login = async (username: string, password: string) => {
    const ar = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'password', identifier: username, password }),
    });
    return (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  };

  const adminCookie = await login('admin', 'admin123');

  // students: password -> prelogin -> face match (embedding identical to creation in dev-setup-student)
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);
  const preCookie = await login('shellstudent', 'ShellPass123');
  const faceRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: preCookie },
    body: JSON.stringify({ mode: 'face', embedding: vec() }),
  });
  if (faceRes.status !== 200) throw new Error('face login failed ' + faceRes.status);
  const studCookie = (faceRes.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const AH = (m: string, o?: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: o ? JSON.stringify(o) : undefined });
  const SH = (m: string, o?: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json', Cookie: studCookie }, body: o ? JSON.stringify(o) : undefined });

  // locate shellstudent's batch + a subject allotted to its class
  const { students } = (await (await fetch(`${BASE}/api/admin/students`, { headers: { Cookie: adminCookie } })).json()) as {
    students: { username: string; studentProfile: { id: string; classRoomId: string; batches: { batch: { id: string } }[] } | null }[];
  };
  const me = students.find((s) => s.username === 'shellstudent');
  if (!me?.studentProfile?.batches?.[0]?.batch.id) throw new Error('shellstudent has no batch');
  const batchId = me.studentProfile.batches[0].batch.id;
  const classRoomId = me.studentProfile.classRoomId;
  console.log('batch:', batchId);

  // pick a subject allotted to this class
  const opts = (await (await fetch(`${BASE}/api/enrollment/options`)).json()) as { classes: { id: string; subjects: { id: string }[] }[] };
  const cls = opts.classes.find((c) => c.id === classRoomId);
  const subjectId = cls?.subjects[0]?.id;
  if (!subjectId) throw new Error('no subject for class');

  const mk = { classRoomId, subjectId, difficulty: 'MEDIUM' as const };

  // 1) MCQ question
  const mq = await rep(await fetch(`${BASE}/api/admin/questions`, AH('POST', { ...mk, type: 'MCQ', stem: 'Attempt MCQ ' + Date.now(), options: [{ text: 'right', isCorrect: true }, { text: 'wrong', isCorrect: false }, { text: 'other', isCorrect: false }] })));
  if (mq.status !== 201) throw new Error('MCQ create failed ' + JSON.stringify(mq));
  const mcqId = (mq.body as { question: { id: string } }).question.id;

  // 2) CODING question
  const cq = await rep(await fetch(`${BASE}/api/admin/questions`, AH('POST', {
    ...mk, type: 'CODING', stem: 'Attempt Coding ' + Date.now(),
    allowedLanguages: ['python'], starterCode: { python: 'def solve(a, b):\n    return a + b\n\nprint(solve(int(input()), int(input())))' },
    solutionCode: 'def solve(a, b):\n    return a + b', testCases: [{ input: '2\n3', expected: '5', isHidden: false }],
  })));
  if (cq.status !== 201) throw new Error('CODING create failed ' + JSON.stringify(cq));
  const codId = (cq.body as { question: { id: string } }).question.id;

  // 3) SQL question (SQLite for speed)
  const sq = await rep(await fetch(`${BASE}/api/admin/questions`, AH('POST', {
    ...mk, type: 'SQL', stem: 'Attempt SQL ' + Date.now(),
    sqlDialect: 'SQLite', sqlSchemaSql: 'CREATE TABLE t(id INT, name TEXT)', sqlSeedSql: "INSERT INTO t VALUES (1,'a'),(2,'b')",
  })));
  if (sq.status !== 201) throw new Error('SQL create failed ' + JSON.stringify(sq));
  const sqlId = (sq.body as { question: { id: string } }).question.id;

  // 4) create assessment (open window) + publish
  const now = Date.now();
  const asm = await rep(await fetch(`${BASE}/api/admin/assessments`, AH('POST', {
    batchId, kind: 'MOCK', title: 'Attempt Smoke ' + now, durationMinutes: 60, instructions: 'Read carefully.',
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3600_000).toISOString(),
    shuffleQuestions: true, questions: [{ questionId: mcqId, marks: 2 }, { questionId: codId, marks: 3 }, { questionId: sqlId, marks: 3 }],
  })));
  if (asm.status !== 201) throw new Error('assessment create failed ' + JSON.stringify(asm));
  const aid = (asm.body as { assessment: { id: string } }).assessment.id;
  const pub = await rep(await fetch(`${BASE}/api/admin/assessments/${aid}`, AH('PATCH', { status: 'RELEASED' })));
  if (pub.status !== 200) throw new Error('publish failed ' + JSON.stringify(pub));
  console.log('assessment:', aid, pub.status);

  // map assessmentQuestion ids
  const aqRes = await pg.query('SELECT id, "questionId" FROM "AssessmentQuestion" WHERE "assessmentId" = $1', [aid]);
  const aqByQ: Record<string, string> = {}; aqRes.rows.forEach((r) => (aqByQ[r.questionId] = r.id));
  const optsRes = await pg.query('SELECT id FROM "QuestionOption" WHERE "questionId" = $1 ORDER BY "sortOrder"', [mcqId]);

  // 5) student fetch attempt page (triggers submission creation)
  const page = await fetch(`${BASE}/dashboard/assessments/${aid}`, { headers: { Cookie: studCookie } });
  const html = await page.text();
  console.log('attempt page GET:', page.status, html.includes('Attempt Smoke') ? '(title ok)' : '(TITLE MISSING)');

  const subRes = await pg.query('SELECT id FROM "Submission" WHERE "assessmentId" = $1 ORDER BY "startedAt" DESC LIMIT 1', [aid]);
  if (!subRes.rows[0]) throw new Error('no submission created');
  const subId = subRes.rows[0].id as string;
  console.log('submission:', subId);

  // 6) save MCQ answer
  const sa = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[mcqId], payload: { optionIds: [optsRes.rows[0].id as string] } })));
  console.log('save MCQ:', sa.status, JSON.stringify(sa.body));

  // 7) code run through app proxy
  const run = await rep(await fetch(`${BASE}/api/student/attempt/run`, SH('POST', { language: 'python', code: 'print(sum(int(x) for x in input().split()))' })));
  console.log('code run:', run.status, 'stdout=' + JSON.stringify((run.body as { stdout?: string }).stdout), 'err=' + JSON.stringify((run.body as { error?: string }).error ?? ''));

  // 8) save coding answer + SQL answer
  const sc = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[codId], payload: { language: 'python', code: 'print("hi")', runs: [] } })));
  console.log('save coding:', sc.status);
  const sqlRun = await rep(await fetch(`${BASE}/api/student/attempt/sql-run`, SH('POST', { assessmentQuestionId: aqByQ[sqlId], query: 'SELECT name FROM t WHERE id = 2' })));
  console.log('sql run:', sqlRun.status, 'rows=' + JSON.stringify((sqlRun.body as { rows?: unknown[] }).rows));
  const ss = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[sqlId], payload: { query: 'SELECT name FROM t WHERE id = 2', resultSummary: { rowCount: 1 } } })));
  console.log('save sql:', ss.status);

  // 9) submit
  const su = await rep(await fetch(`${BASE}/api/student/attempt/${subId}/submit`, SH('POST', {})));
  console.log('submit:', su.status, JSON.stringify(su.body));

  // 10) resubmit should 409
  const dupe = await rep(await fetch(`${BASE}/api/student/attempt/${subId}/submit`, SH('POST', {})));
  console.log('resubmit (expect 409):', dupe.status);

  // 11) attempt page now says already submitted
  const page2 = await (await fetch(`${BASE}/dashboard/assessments/${aid}`, { headers: { Cookie: studCookie } })).text();
  console.log('page2 already-submitted:', page2.includes('Already submitted'));

  // cleanup
  await fetch(`${BASE}/api/admin/assessments/${aid}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  await fetch(`${BASE}/api/admin/questions/${mcqId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  await fetch(`${BASE}/api/admin/questions/${codId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  await fetch(`${BASE}/api/admin/questions/${sqlId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  console.log('cleaned up');
  await pg.end();
}

main().catch((e) => { console.error(e); process.exit(1); });