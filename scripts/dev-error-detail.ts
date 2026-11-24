import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const br = await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: cookie } })).json();
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'err q' };
  const qq = (await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'x' }, solutionCode: 'y', testCases: [{ input: '', expected: '1', isHidden: false, weight: 1 }] }) })).json();
  const qqq = await qq;
  const ad = (await fetch(`${BASE}/api/admin/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ batchId: br.classroom.batches[0].id, kind: 'TEST', title: 'Err Test', durationMinutes: 30, proctoring: { webcamOn: true, fullscreenLock: true, blockPaste: false, maxTabSwitches: 2 }, questions: [{ questionId: qqq.question.id, marks: 5 }] }) })).json();
  const aa = await ad;
  const html = await (await fetch(`${BASE}/admin/assessments/${aa.assessment.id}?__next_s=0`, { headers: { Cookie: cookie } })).text();
  const i = html.indexOf('Error');
  console.log(html.slice(i - 400, i + 1500));
  await fetch(`${BASE}/api/admin/assessments/${aa.assessment.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  await fetch(`${BASE}/api/admin/questions/${qqq.question.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
