import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const rep = async (r: Response): Promise<{ status: number; body: Record<string, unknown> & { ok?: boolean; released?: number; gradedAnswers?: number; submissionsTouched?: number } }> => ({
    status: r.status,
    body: await r.json().catch(() => ({})),
  });
  const cookies = (r: Response) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const login = async (username: string, password: string) => {
    const ar = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'password', identifier: username, password }),
    });
    return cookies(ar);
  };

  const adminCookie = await login('admin', 'admin123');

  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);
  const preCookie = await login('shellstudent', 'ShellPass123');
  const faceRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: preCookie },
    body: JSON.stringify({ mode: 'face', embedding: vec() }),
  });
  if (faceRes.status !== 200) throw new Error('face login failed ' + faceRes.status);
  const studCookie = cookies(faceRes);

  const AH = (o?: unknown) => ({ method: 'PATCH' as const, headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: o === undefined ? undefined : JSON.stringify(o) });
  const AHP = (m: 'POST' | 'PATCH' | 'PUT' | 'DELETE', o?: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: o === undefined ? undefined : JSON.stringify(o) });
  const SH = (m: 'POST' | 'PATCH', o: unknown) => ({ method: m, headers: { 'Content-Type': 'application/json', Cookie: studCookie }, body: JSON.stringify(o) });

  // batch + subject via admin students endpoint
  const { students } = (await (await fetch(`${BASE}/api/admin/students`, { headers: { Cookie: adminCookie } })).json()) as {
    students: { username: string; studentProfile: { id: string; classRoomId: string; batches: { batch: { id: string } }[] } | null }[];
  };
  const me = students.find((s) => s.username === 'shellstudent');
  if (!me?.studentProfile?.batches?.[0]?.batch.id) throw new Error('shellstudent has no batch');
  const batchId = me.studentProfile.batches[0].batch.id;
  const opts = (await (await fetch(`${BASE}/api/enrollment/options`)).json()) as { classes: { id: string; subjects: { id: string }[] }[] };
  const cls = opts.classes.find((c) => c.id === me!.studentProfile!.classRoomId);
  const subjectId = cls?.subjects[0]?.id;
  if (!subjectId) throw new Error('no subject for class');

  const mk = { classRoomId: me.studentProfile.classRoomId, subjectId, difficulty: 'MEDIUM' as const };
  const tag = 'P8-' + Date.now();
  const newQ = async (type: string, body: Record<string, unknown>) =>
    rep(await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ ...mk, type, ...body }) }));
  const qid = (r: { status: number; body: { question?: { id?: string } | null } & Record<string, unknown> }) => {
    if (r.status !== 201) throw new Error('question create failed ' + JSON.stringify(r));
    return r.body.question!.id!;
  };

  const mcq1 = qid(await newQ('MCQ', { stem: tag + ' mcq1', marks: 2, options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: false }, { text: '5', isCorrect: true }, { text: '6', isCorrect: false }] }));
  const mcq2 = qid(await newQ('MCQ', { stem: tag + ' mcq2', marks: 3, options: [{ text: 'a', isCorrect: false }, { text: 'b', isCorrect: true }] }));
  const cod = qid(await newQ('CODING', {
    stem: tag + ' code', marks: 4, allowedLanguages: ['python'],
    starterCode: { python: 'print(sum(int(x) for x in input().split()))' },
    solutionCode: 's = [int(x) for x in input().split()]\nprint(sum(s))',
    testCases: [{ input: '2\n3', expected: '5', isHidden: false }, { input: '1\n1', expected: '2', isHidden: false }],
  }));
  const sql = qid(await newQ('SQL', {
    stem: tag + ' sql', marks: 5, sqlDialect: 'SQLite',
    sqlSchemaSql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)',
    sqlSeedSql: "INSERT INTO t VALUES (1, 'a'), (2, 'b')",
    sqlExpectedResult: [['b']], sqlComparisonMode: 'UNORDERED',
  }));
  const shor = qid(await newQ('SHORT', { stem: tag + ' short', marks: 4 }));
  console.log('questions:', { mcq1, mcq2, cod, sql, shor });

  const asm = await rep(await fetch(`${BASE}/api/admin/assessments`, AHP('POST', {
    batchId, kind: 'MOCK', title: tag + ' grading', durationMinutes: 60, instructions: 'Phase 8 smoke',
    startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(),
    shuffleQuestions: true,
    questions: [
      { questionId: mcq1, marks: 2 }, { questionId: mcq2, marks: 3 }, { questionId: cod, marks: 4 },
      { questionId: sql, marks: 5 }, { questionId: shor, marks: 4 },
    ],
  })));
  if (asm.status !== 201) throw new Error('assessment create failed ' + JSON.stringify(asm.body));
  const aid = (asm.body as { assessment: { id: string } }).assessment.id;
  const pub = await rep(await fetch(`${BASE}/api/admin/assessments/${aid}`, { ...AH({ status: 'RELEASED' }), method: 'PATCH' }));
  if (pub.status !== 200) throw new Error('publish failed ' + JSON.stringify(pub));
  console.log('assessment:', aid);

  const aqRes = await pg.query('SELECT id, "questionId" FROM "AssessmentQuestion" WHERE "assessmentId" = $1', [aid]);
  const aqByQ: Record<string, string> = {}; aqRes.rows.forEach((r) => (aqByQ[r.questionId] = r.id));
  const optsRes = await pg.query('SELECT id FROM "QuestionOption" WHERE "questionId" = $1 ORDER BY "sortOrder"', [mcq1]);
  const correct = optsRes.rows.find((r) => r.id === optsRes.rows[2]?.id)?.id ?? optsRes.rows[2]?.id;

  // student attempt page -> creates submission
  const page = await fetch(`${BASE}/dashboard/assessments/${aid}`, { headers: { Cookie: studCookie } });
  if (page.status !== 200) throw new Error('attempt page ' + page.status);
  const subRes = await pg.query('SELECT id FROM "Submission" WHERE "assessmentId" = $1 ORDER BY "startedAt" DESC LIMIT 1', [aid]);
  if (!subRes.rows[0]) throw new Error('no submission');
  const subId = subRes.rows[0].id as string;
  console.log('submission:', subId);

  const sa = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[mcq1], payload: { optionIds: [correct] } })));
  if (sa.status !== 200) throw new Error('save mcq ' + sa.status);
  const sc = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[cod], payload: { language: 'python', code: 'import sys\nprint(sum(int(x) for x in sys.stdin.read().split()))', runs: [] } })));
  if (sc.status !== 200) throw new Error('save code ' + sc.status);
  const ss = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[sql], payload: { query: 'SELECT name FROM t WHERE id = 2', resultSummary: { rowCount: 1 } } })));
  if (ss.status !== 200) throw new Error('save sql ' + ss.status);
  const ss2 = await rep(await fetch(`${BASE}/api/student/attempt/${subId}`, SH('PATCH', { assessmentQuestionId: aqByQ[shor], payload: { text: 'Because id = 2 has name b.' } })));
  if (ss2.status !== 200) throw new Error('save short ' + ss2.status);
  console.log('leave mcq2 unanswered to verify zero-fill');

  const su = await rep(await fetch(`${BASE}/api/student/attempt/${subId}/submit`, SH('POST', {})));
  if (su.status !== 200) throw new Error('submit ' + su.status + ' ' + JSON.stringify(su.body));

  const close = await rep(await fetch(`${BASE}/api/admin/assessments/${aid}`, { ...AH({ status: 'CLOSED' }), method: 'PATCH' }));
  if (close.status !== 200) throw new Error('close ' + close.status);

  const ev = await rep(await fetch(`${BASE}/api/admin/assessments/${aid}/evaluate`, AHP('POST', {})));
  if (ev.status !== 200 || ev.body.ok !== true) throw new Error('evaluate ' + ev.status + ' ' + JSON.stringify(ev.body));
  console.log('gradedAnswers:', ev.body.gradedAnswers, 'submissionsTouched:', ev.body.submissionsTouched);

  const sub = (await pg.query('SELECT "autoScore", "manualScore", "totalScore", status FROM "Submission" WHERE id = $1', [subId])).rows[0];
  const ans = await pg.query('SELECT "assessmentQuestionId", "marksAwarded", "isAutoCorrect" FROM "Answer" WHERE "submissionId" = $1', [subId]);
  const gm = (q: string) => ans.rows.find((r) => r.assessmentQuestionId === aqByQ[q])?.marksAwarded;
  const autoOf = (q: string) => ans.rows.find((r) => r.assessmentQuestionId === aqByQ[q])?.isAutoCorrect;
  if (!(gm(mcq1) === 2)) throw new Error('mcq1 not 2, got ' + gm(mcq1));
  if (!(gm(cod) === 4)) throw new Error('coding not 4, got ' + gm(cod));
  if (!(gm(sql) === 5)) throw new Error('sql not 5, got ' + gm(sql));
  if (!(gm(mcq2) === 0 && autoOf(mcq2) === true)) throw new Error('mcq2 not zero-filled');
  if (!(ans.rows.length === 5)) throw new Error('expected 5 answer rows, got ' + ans.rows.length);
  if (!(sub.status === 'EVALUATED')) throw new Error('submission not EVALUATED');
  if (!(sub.autoScore === 11)) throw new Error('autoScore not 11, got ' + sub.autoScore);
  if (!(gm(shor) === null)) throw new Error('short pre-graded? ' + gm(shor));
  console.log('auto grades verified. autoScore=', sub.autoScore);

  const shorAid = await pg.query('SELECT id FROM "Answer" WHERE "submissionId" = $1 AND "assessmentQuestionId" = $2', [subId, aqByQ[shor]]);
  const shorAnsId = shorAid.rows[0].id as string;
  const mg = await rep(await fetch(`${BASE}/api/admin/submissions/${subId}`, AHP('PATCH', {
    answers: [{ answerId: shorAnsId, marksAwarded: 3, feedback: 'Good but terse.' }],
    feedback: 'Aim for full marks next time.',
  })));
  if (mg.status !== 200 || mg.body.ok !== true) throw new Error('manual grade ' + mg.status + ' ' + JSON.stringify(mg.body));
  const sub2 = (await pg.query('SELECT "manualScore", status FROM "Submission" WHERE id = $1', [subId])).rows[0];
  if (!(sub2.manualScore === 3)) throw new Error('manualScore not 3, got ' + sub2.manualScore);
  console.log('manual grade saved. manualScore=', sub2.manualScore);

  const rel = await rep(await fetch(`${BASE}/api/admin/assessments/${aid}/release`, AHP('POST', {})));
  if (rel.status !== 200 || rel.body.ok !== true) throw new Error('release ' + rel.status + ' ' + JSON.stringify(rel.body));
  if (!(rel.body.released === 1)) throw new Error('released != 1');
  const dbRel = (await pg.query('SELECT "totalScore", "releasedAt" FROM "Submission" WHERE id = $1', [subId])).rows[0];
  if (!(dbRel.totalScore === 14)) throw new Error('totalScore not 14, got ' + dbRel.totalScore);
  const rec = await pg.query('SELECT id FROM "ReportRecord" WHERE "assessmentId" = $1', [aid]);
  if (!rec.rows[0]) throw new Error('ReportRecord missing');
  const ast = (await pg.query('SELECT status FROM "Assessment" WHERE id = $1', [aid])).rows[0];
  if (ast.status !== 'RELEASED_TO_STUDENTS') throw new Error('assessment status ' + ast.status);
  console.log('released: totalScore=', dbRel.totalScore, 'report:', rec.rows[0].id);

  const pageRes = await fetch(`${BASE}/dashboard/results`, { headers: { Cookie: studCookie } });
  const pageResults = await pageRes.text();
  if (pageRes.status !== 200 || !pageResults.includes('View breakdown')) throw new Error('results list missing breakdown link // ' + pageRes.status);
  const dRes = await fetch(`${BASE}/dashboard/results/${subId}`, { headers: { Cookie: studCookie } });
  if (dRes.status !== 200) throw new Error('result detail ' + dRes.status);
  const rHtml = await dRes.text();
  if (!rHtml.includes('14') ) throw new Error('detail missing score');
  const repRes = await fetch(`${BASE}/dashboard/reports`, { headers: { Cookie: studCookie } });
  if (repRes.status !== 200) throw new Error('reports ' + repRes.status);
  const rp = await repRes.text();
  if (!rp.includes('Average score') || !rp.includes(tag)) throw new Error('reports summary/entries missing');
  const act = await fetch(`${BASE}/dashboard/activity`, { headers: { Cookie: studCookie } });
  if (act.status !== 200) throw new Error('activity ' + act.status);
  const tests = await fetch(`${BASE}/dashboard/tests`, { headers: { Cookie: studCookie } });
  if (tests.status !== 200) throw new Error('tests ' + tests.status);

  console.log('\n=== PHASE 8 SMOKE PASSED ===');

  await pg.query('DELETE FROM "ReportRecord" WHERE "assessmentId" = $1', [aid]).catch(() => null);
  await pg.query('DELETE FROM "Submission" WHERE "assessmentId" = $1', [aid]);
  await pg.query('DELETE FROM "Assessment" WHERE id = $1', [aid]);
  for (const q of [mcq1, mcq2, cod, sql, shor]) await fetch(`${BASE}/api/admin/questions/${q}`, AHP('DELETE')).catch(() => null);
  console.log('cleaned up');
  await pg.end();
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message ?? e); process.exit(1); });