import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const H = (m: string) => ({ method: m, headers: { Cookie: cookie } });
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const br = await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, H('GET'))).json();
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'detail q' };
  const q = (await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'CODING', allowedLanguages: ['python'], starterCode: { python: 'x' }, solutionCode: 'y', testCases: [{ input: '', expected: '1', isHidden: false, weight: 1 }] }) })).json();
  const qd = await q;
  const a = (await fetch(`${BASE}/api/admin/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ batchId: br.classroom.batches[0].id, kind: 'TEST', title: 'Detail Check Test', durationMinutes: 30, proctoring: { webcamOn: true, fullscreenLock: true, blockPaste: false, maxTabSwitches: 2 }, questions: [{ questionId: qd.question.id, marks: 5 }] }) })).json();
  const ad = await a;
  const d = await (await fetch(`${BASE}/admin/assessments/${ad.assessment.id}`, H('GET'))).text();
  console.log('detail render:', d.includes('Proctoring') && d.includes('Webcam') && d.includes('Submissions') ? 'ok' : 'FAIL', 'status', ad.assessment.status);
  await fetch(`${BASE}/api/admin/assessments/${ad.assessment.id}`, H('DELETE'));
  await fetch(`${BASE}/api/admin/questions/${qd.question.id}`, H('DELETE'));
}
main().catch((e) => { console.error(e); process.exit(1); });
