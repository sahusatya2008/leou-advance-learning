import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);

  // admin: create student + assign batch
  const ar = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'admin', password: 'admin123' }) });
  const acookie = (ar.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');

  const opts = await (await fetch(`${BASE}/api/enrollment/options`)).json();
  const cls = opts.classes.find((c: { hasStreams: boolean; subjects: unknown[] }) => c.hasStreams && c.subjects.length);
  const create = await fetch(`${BASE}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({
    fullName: 'Shell Test Student', classRoomId: cls.id, stream: 'SCIENCE', subjectIds: [cls.subjects[0].id],
    schoolName: 'Test School', schoolStatus: 'CURRENT', email: 'shell@leou.test', phone: '+917700000003',
    username: 'shellstudent', password: 'ShellPass123', faceEmbeddings: [vec(), vec(), vec(), vec(), vec()],
    facePhoto: 'data:image/jpeg;base64,aW1n', }) });
  const sid = (await create.json()).student?.id;

  const br = await fetch(`${BASE}/api/admin/classes/${cls.id}/batches`, { headers: { Cookie: acookie } });
  const brData = (await br.json()).classroom.batches;
  const batchId = brData[0].id;
  const batchName = brData[0].name;
  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({ batchIds: [batchId] }) });

  // student login
  const lr = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'password', identifier: 'shellstudent', password: 'ShellPass123' }) });
  const scookie = (lr.headers.getSetCookie?.() ?? []).map((c: string) => c.split(';')[0]).join('; ');

  const pages = [`/dashboard`, `/dashboard/classes`, `/dashboard/classes/${batchId}`, `/dashboard/tests`, `/dashboard/results`, `/dashboard/reports`, `/dashboard/activity`, `/dashboard/payments`];
  for (const p of pages) {
    const res = await fetch(`${BASE}${p}`, { headers: { Cookie: scookie }, redirect: 'manual' });
    console.log(p, '->', res.status);
  }
  const home = await (await fetch(`${BASE}/dashboard`, { headers: { Cookie: scookie } })).text();
  console.log('home shows name + batch:', home.includes('Shell Test Student'), home.includes(batchName));
  const batchPage = await (await fetch(`${BASE}/dashboard/classes/${batchId}`, { headers: { Cookie: scookie } })).text();
  console.log('batch page renders tabs:', batchPage.includes('Assignments'), batchPage.includes('Mock Tests'));

  // cleanup
  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'DELETE', headers: { Cookie: acookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
