import 'dotenv/config';
async function main() {
  const BASE = process.env.BASE ?? 'http://localhost:3001';
  const vec = () => Array.from({ length: 128 }, (_, i) => 0.1 + (i % 7) * 0.013);

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
  const batches_ = (await br.json()).classroom.batches;
  const batchId = batches_[0].id;
  const batchName = batches_[0].name;
  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: acookie }, body: JSON.stringify({ batchIds: [batchId] }) });

  // full login: password step then face step (shares cookies)
  const jar = new Map<string, string>();
  async function login(body: unknown) {
    const ck = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ck }, body: JSON.stringify(body) });
    (r.headers.getSetCookie?.() ?? []).forEach((c: string) => { const [pair] = c.split(';'); const i = pair.indexOf('='); jar.set(pair.slice(0, i), pair.slice(i + 1)); });
    return r;
  }
  await login({ mode: 'password', identifier: 'shellstudent', password: 'ShellPass123' });
  const face = await login({ mode: 'face', embedding: vec() });
  console.log('face login:', face.status);
  const scookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  console.log('has session:', scookie.includes('leou_session='));

  const pages = [`/dashboard`, `/dashboard/classes`, `/dashboard/classes/${batchId}`, `/dashboard/tests`, `/dashboard/results`, `/dashboard/reports`, `/dashboard/activity`, `/dashboard/payments`];
  for (const p of pages) {
    const res = await fetch(`${BASE}${p}`, { headers: { Cookie: scookie }, redirect: 'manual' });
    console.log(p, '->', res.status);
  }
  const home = await (await fetch(`${BASE}/dashboard`, { headers: { Cookie: scookie } })).text();
  console.log('home shows name/batch:', home.includes('Shell Test Student'), home.includes(batchName));
  const stray = await fetch(`${BASE}/dashboard/classes/nonexistent`, { headers: { Cookie: scookie }, redirect: 'manual' });
  console.log('foreign/unknown batch (expect 404):', stray.status);

  await fetch(`${BASE}/api/admin/students/${sid}`, { method: 'DELETE', headers: { Cookie: acookie } });
}
main().catch((e) => { console.error(e); process.exit(1); });
