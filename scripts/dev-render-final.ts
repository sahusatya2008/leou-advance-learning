import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const cookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');
  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const br = await (await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: cookie } })).json();
  const mk = { classRoomId: cls.id, subjectId: cls.subjects[0].id, difficulty: 'MEDIUM', stem: 'final q' };
  const qd = (await fetch(`${BASE}/api/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...mk, type: 'MCQ', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }] }) })).json();
  const qq = await qd;
  const ad = (await fetch(`${BASE}/api/admin/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ batchId: br.classroom.batches[0].id, kind: 'ASSIGNMENT', title: 'Final Render Check', durationMinutes: 45, shuffleQuestions: false, questions: [{ questionId: qq.question.id, marks: 4 }] }) })).json();
  const aa = await ad;
  const list = await (await fetch(`${BASE}/admin/assessments`, { headers: { Cookie: cookie } })).text();
  console.log('list (populated):', list.includes('Final Render Check') && list.includes('Assignment') ? 'ok' : 'FAIL');
  const detail = await (await fetch(`${BASE}/admin/assessments/${aa.assessment.id}`, { headers: { Cookie: cookie } })).text();
  console.log('detail:', detail.includes('Questions') && detail.includes('Submissions') && detail.includes('Final Render Check') ? 'ok' : 'FAIL');
  await fetch(`${BASE}/api/admin/assessments/${aa.assessment.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  await fetch(`${BASE}/api/admin/questions/${qq.question.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
