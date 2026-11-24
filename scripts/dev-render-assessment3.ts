import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const br = await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: cookie } })).json();
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'detail q2' };
  const qd = (await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'x' }, solutionCode: 'y', testCases: [{ input: '', expected: '1', isHidden: false, weight: 1 }] }) })).json();
  const qq = await qd;
  const ad = (await fetch(`${BASE}/api/admin/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ batchId: br.classroom.batches[0].id, kind: 'TEST', title: 'Detail Check Test', durationMinutes: 30, proctoring: { webcamOn: true, fullscreenLock: true, blockPaste: false, maxTabSwitches: 2 }, questions: [{ questionId: qq.question.id, marks: 5 }] }) })).json();
  const aa = await ad;
  const res = await fetch(`${BASE}/admin/assessments/${aa.assessment.id}`, { headers: { Cookie: cookie } });
  const html = await res.text();
  console.log('status:', res.status, 'has Questions:', html.includes('Questions'), 'has Submissions:', html.includes('Submissions'), 'has Proctoring:', html.includes('Proctoring'));
  if (!html.includes('Questions')) console.log(html.slice(0, 800));
  await fetch(`${BASE}/api/admin/assessments/${aa.assessment.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  await fetch(`${BASE}/api/admin/questions/${qq.question.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
